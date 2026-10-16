import { connection } from "next/server";
import { fetchLocation, serviceDb } from "@/lib/placeCoords";

// 매일 한 번(Vercel Cron)
// 1) 최근 30일 안에 누가 본 리스트의 장소 중, 좌표를 받은 지 25일이 넘은 것만 다시 받는다.
// 2) 30일 동안 아무도 안 본 장소의 좌표는 지운다(다시 열리면 그때 받는다).
// 3) 보관 기간이 지난 예약 문의 개인정보를 지운다.
// 4) 서비스 예산을 확인해 넘을 것 같으면 운영자에게 알린다. 하루 지난 요청 제한 기록, 2년 지난 링크 기록, 1년 지난 해결된 오류를 지운다.
// 실행 결과는 job_runs에 남는다(운영자 콘솔 → 서비스 사용량).
// 5) 메일 발송(Resend) 사용량을 받아 기록하고, 하루·한 달 한도의 80%를 넘으면 운영자에게 알린다.
// 필요한 환경 변수: SUPABASE_SERVICE_ROLE_KEY(DB 쓰기), CRON_SECRET(호출 확인), RESEND_API_KEY(전체 권한 키, 사용량 조회용 — 없으면 건너뜀)
const BATCH = 300;

export async function GET(req: Request) {
  await connection();
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    // Vercel Cron이 불렀는데 비밀값이 안 맞으면 기록을 남겨 운영자 콘솔에서 알 수 있게 한다
    if ((req.headers.get("user-agent") ?? "").startsWith("vercel-cron")) {
      const db = serviceDb();
      if (db && (await db.rpc("rate_hit", { p_key: "cron:unauth", p_limit: 3, p_seconds: 86400 })).data)
        await db.from("job_runs").insert({ job: "daily", ok: false, detail: { error: secret ? "CRON_SECRET이 맞지 않아요" : "CRON_SECRET이 설정되지 않았어요" } });
    }
    return new Response("unauthorized", { status: 401 });
  }
  const db = serviceDb();
  if (!db) return Response.json({ skipped: "missing SUPABASE_SERVICE_ROLE_KEY" });

  try {
    const { data: rows } = await db.rpc("places_to_refresh", { lim: BATCH });
    let updated = 0, gone = 0;
    for (const { google_place_id: id } of (rows ?? []) as { google_place_id: string }[]) {
      const loc = await fetchLocation(id);
      if (loc === "gone") {
        await db.from("places").update({ lat: null, lng: null, coords_fetched_at: new Date().toISOString() }).eq("google_place_id", id);
        gone++;
      } else if (loc) {
        await db.from("places").update({ ...loc, coords_fetched_at: new Date().toISOString() }).eq("google_place_id", id);
        updated++;
      }
    }
    const { data: expired } = await db.rpc("expire_unviewed_coords");
    // 3) 방문일로부터 1년이 지난 예약 문의의 이름·연락처·메시지를 지운다(개인정보처리방침 6번)
    const { data: anonymized } = await db.rpc("anonymize_old_reservations");
    const { data: budget } = await db.rpc("run_budget_check");
    await db.from("rate_limits").delete().lt("window_start", new Date(Date.now() - 86400_000).toISOString());
    // 개인정보처리방침 6번의 보관 기간: 링크 이용 기록 2년, 고친 오류 기록 1년
    const ago = (days: number) => new Date(Date.now() - days * 86400_000).toISOString();
    await db.from("link_events").delete().lt("created_at", ago(730));
    await db.from("error_logs").delete().eq("resolved", true).lt("last_at", ago(365));
    const resend = await checkResend(db);
    const detail = { checked: rows?.length ?? 0, updated, gone, expired, anonymized, budget, resend };
    await db.from("job_runs").insert({ job: "daily", ok: true, detail });
    return Response.json(detail);
  } catch (e) {
    await db.from("job_runs").insert({ job: "daily", ok: false, detail: { error: String(e) } });
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

type Win = { used: number; limit: number | null };
const ALERT_PCT = 80;

// Resend 사용량(GET https://api.resend.com/usage). 무료: 하루 100통, 한 달 3,000통(하루는 UTC 자정에 초기화).
async function checkResend(db: NonNullable<ReturnType<typeof serviceDb>>) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { skipped: "RESEND_API_KEY 없음" };
  try {
    const r = await fetch("https://api.resend.com/usage", { headers: { authorization: `Bearer ${key}` }, cache: "no-store" });
    if (!r.ok) return { error: `HTTP ${r.status}` };
    // 응답: { emails: { daily: { used, limit, sent, received, resets_at }, monthly: {…} } } — 유료 요금제는 daily.limit이 null
    const j = (await r.json()) as { emails?: { daily?: Win; monthly?: Win } };
    const pick = (w?: Win) => (w ? { used: Number(w.used ?? 0), limit: w.limit == null ? null : Number(w.limit) } : null);
    const daily = pick(j.emails?.daily);
    const monthly = pick(j.emails?.monthly);
    const pct = (w: Win | null) => (w && w.limit ? Math.round((w.used / w.limit) * 100) : null);
    const out = { daily, monthly, daily_pct: pct(daily), monthly_pct: pct(monthly) };
    const over = [
      out.daily_pct != null && out.daily_pct >= ALERT_PCT ? `오늘 ${daily!.used}/${daily!.limit}통(${out.daily_pct}%)` : null,
      out.monthly_pct != null && out.monthly_pct >= ALERT_PCT ? `이번 달 ${monthly!.used}/${monthly!.limit}통(${out.monthly_pct}%)` : null,
    ].filter(Boolean);
    // 하루 한 번만 알린다
    if (over.length && (await db.rpc("rate_hit", { p_key: "alert:resend", p_limit: 1, p_seconds: 86400 })).data) {
      const { data: admins } = await db.from("admins").select("user_id");
      const body = `📧 메일 발송 한도에 가까워요: ${over.join(", ")}. 한도를 넘으면 로그인 메일이 가지 않아요. Resend 요금제를 올리거나 사용량을 확인하세요.`;
      if (admins?.length) await db.from("notifications").insert(admins.map((a) => ({ user_id: a.user_id, kind: "ops", body })));
      return { ...out, alerted: true };
    }
    return out;
  } catch (e) {
    return { error: String(e) };
  }
}
