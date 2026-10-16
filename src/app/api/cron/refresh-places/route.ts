import { connection } from "next/server";
import { fetchLocation, serviceDb } from "@/lib/placeCoords";

// 매일 한 번(Vercel Cron)
// 1) 최근 30일 안에 누가 본 리스트의 장소 중, 좌표를 받은 지 25일이 넘은 것만 다시 받는다.
// 2) 30일 동안 아무도 안 본 장소의 좌표는 지운다(다시 열리면 그때 받는다).
// 3) 보관 기간이 지난 예약 문의 개인정보를 지운다.
// 4) 서비스 예산을 확인해 넘을 것 같으면 운영자에게 알린다. 하루 지난 요청 제한 기록, 2년 지난 링크 기록, 1년 지난 해결된 오류를 지운다.
// 실행 결과는 job_runs에 남는다(운영자 콘솔 → 서비스 사용량).
// 필요한 환경 변수: SUPABASE_SERVICE_ROLE_KEY(DB 쓰기), CRON_SECRET(호출 확인)
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
    const detail = { checked: rows?.length ?? 0, updated, gone, expired, anonymized, budget };
    await db.from("job_runs").insert({ job: "daily", ok: true, detail });
    return Response.json(detail);
  } catch (e) {
    await db.from("job_runs").insert({ job: "daily", ok: false, detail: { error: String(e) } });
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
