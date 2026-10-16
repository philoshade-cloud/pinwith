"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ConfirmButton } from "./console/ui";

const num = (v: number | string | null | undefined, d = 0) => Number(v ?? 0).toLocaleString("ko-KR", { maximumFractionDigits: d });
const when = (s: string) => new Date(s).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

// ── 서비스 사용량: 요금이 나가는 사용량을 세서 월말을 예상하고, 예산을 넘을 것 같으면 알린다 ──────────
type Item = { kind: string; service: string; label: string; usd_per_1000: number; free: number; month: number; projected: number; cost: number; projected_cost: number; last7: { d: string; n: number }[] };
type Budget = { service: string; label: string; monthly_budget_usd: number; alert_pct: number; last_alert_on: string | null };
type Usage = { day_of_month: number; days_in_month: number; items: Item[]; budgets: Budget[]; db_mb: number; jobs: { job: string; ran_at: string; ok: boolean; detail: Record<string, unknown> | null }[] };

export function UsagePanel() {
  const supabase = useMemo(() => createClient(), []);
  const [u, setU] = useState<Usage | null>(null);
  const [msg, setMsg] = useState("");
  const [now, setNow] = useState(0);
  const load = useCallback(async () => {
    setNow(Date.now());
    const { data, error } = await supabase.rpc("admin_usage");
    if (error) setMsg("불러오지 못했어요.");
    setU((data as Usage) ?? null);
  }, [supabase]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function saveBudget(service: string, patch: Partial<Budget>) {
    const { error } = await supabase.from("service_budgets").update(patch).eq("service", service);
    setMsg(error ? "저장하지 못했어요." : "저장했어요.");
    load();
  }
  async function savePrice(kind: string, patch: { usd_per_1000?: number; free_per_month?: number }) {
    const { error } = await supabase.from("usage_prices").update(patch).eq("kind", kind);
    setMsg(error ? "저장하지 못했어요." : "저장했어요.");
    load();
  }

  if (!u) return <p className="text-muted">{msg || "불러오는 중…"}</p>;
  const google = u.items.filter((i) => i.service === "google");
  const gNow = google.reduce((s, i) => s + Number(i.cost), 0);
  const gProj = google.reduce((s, i) => s + Number(i.projected_cost), 0);
  const gb = u.budgets.find((b) => b.service === "google");
  const db = u.budgets.find((b) => b.service === "supabase_db");
  const last = u.jobs.find((j) => j.job === "daily");
  const lastAgeH = last ? (now - new Date(last.ran_at).getTime()) / 3600_000 : null;

  return (
    <section className="grid gap-5">
      <p className="text-[13px] text-muted">
        PinWith 안에서 센 사용량으로 이번 달 요금을 어림해요(오늘 {u.day_of_month}일 / {u.days_in_month}일 기준으로 월말 예상). 매일 자동 작업이 예상치를 예산과 비교해, 알림 기준을 넘으면
        운영자에게 알림·휴대폰 알림을 보내요(하루 1번). 실제 청구액은 각 서비스 결제 화면이 정확하니, 구글 클라우드 예산 알림·Vercel 지출 한도·Supabase 사용량 메일도 함께 켜 두세요.
      </p>
      {msg && <p role="status" className="text-[14px] text-teal">{msg}</p>}

      <GoogleSwitch />
      <LoginSwitch />

      <div className="grid gap-3 sm:grid-cols-3">
        <Box title="구글 지도 이번 달" value={`$${num(gNow, 2)}`} hint={`월말 예상 $${num(gProj, 2)}`} warn={!!gb && gb.monthly_budget_usd > 0 && gProj >= (gb.monthly_budget_usd * gb.alert_pct) / 100} />
        <Box title="데이터베이스 용량" value={`${num(u.db_mb, 1)} MB`} hint={db ? `한도 ${num(db.monthly_budget_usd)} MB` : ""} warn={!!db && db.monthly_budget_usd > 0 && u.db_mb >= (db.monthly_budget_usd * db.alert_pct) / 100} />
        <Box
          title="매일 자동 작업"
          value={last ? (last.ok ? "정상" : "실패") : "기록 없음"}
          hint={last ? `${when(last.ran_at)}${lastAgeH && lastAgeH > 30 ? " · 하루 넘게 안 돎" : ""}` : "아직 한 번도 기록되지 않았어요"}
          warn={!last || !last.ok || (lastAgeH ?? 0) > 30}
        />
      </div>

      <div>
        <h2 className="text-[15px] font-semibold">예산과 알림 기준</h2>
        <ul className="mt-2 grid gap-2">
          {u.budgets.map((b) => (
            <li key={b.service} className="flex flex-wrap items-end gap-3 rounded-xl border border-rule p-3 text-[14px]">
              <b className="min-w-[180px] flex-1">{b.label}</b>
              <label className="grid gap-1 text-[12px] font-semibold">
                {b.service === "supabase_db" ? "한도(MB)" : "한 달 예산(USD)"}
                <input type="number" min={0} defaultValue={b.monthly_budget_usd} className="field !w-28 !py-1"
                  onBlur={(e) => Number(e.target.value) !== Number(b.monthly_budget_usd) && saveBudget(b.service, { monthly_budget_usd: Math.max(0, Number(e.target.value) || 0) })} />
              </label>
              <label className="grid gap-1 text-[12px] font-semibold">
                알림 기준(%)
                <input type="number" min={10} max={200} defaultValue={b.alert_pct} className="field !w-20 !py-1"
                  onBlur={(e) => Number(e.target.value) !== b.alert_pct && saveBudget(b.service, { alert_pct: Math.min(200, Math.max(10, Number(e.target.value) || 80)) })} />
              </label>
              <span className="text-[12px] text-muted">{b.last_alert_on ? `마지막 알림 ${b.last_alert_on}` : "알림 보낸 적 없음"}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h2 className="text-[15px] font-semibold">구글 지도 사용량 <span className="text-[12px] font-normal text-muted">요금표는 구글 가격이 바뀌면 고쳐 주세요</span></h2>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <thead className="text-[12px] text-muted">
              <tr><th className="py-1">항목</th><th>이번 달</th><th>월말 예상</th><th>무료/월</th><th>$/1000건</th><th>이번 달 요금</th><th>예상 요금</th><th>최근 7일</th></tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {u.items.map((i) => {
                const max = Math.max(1, ...i.last7.map((x) => x.n));
                return (
                  <tr key={i.kind}>
                    <td className="py-2 pr-2">{i.label}</td>
                    <td>{num(i.month)}</td>
                    <td>{num(i.projected)}</td>
                    <td><input type="number" min={0} defaultValue={i.free} className="field !w-24 !py-0.5" onBlur={(e) => Number(e.target.value) !== i.free && savePrice(i.kind, { free_per_month: Math.max(0, Number(e.target.value) || 0) })} /></td>
                    <td><input type="number" min={0} step="0.01" defaultValue={i.usd_per_1000} className="field !w-20 !py-0.5" onBlur={(e) => Number(e.target.value) !== Number(i.usd_per_1000) && savePrice(i.kind, { usd_per_1000: Math.max(0, Number(e.target.value) || 0) })} /></td>
                    <td>${num(i.cost, 2)}</td>
                    <td className={Number(i.projected_cost) > 0 ? "font-semibold text-pin" : ""}>${num(i.projected_cost, 2)}</td>
                    <td>
                      <span className="flex h-6 items-end gap-0.5" title={i.last7.map((x) => `${x.d}: ${x.n}`).join("\n")}>
                        {i.last7.map((x) => <span key={x.d} className="w-2 rounded-sm bg-teal" style={{ height: `${Math.max(8, (x.n / max) * 100)}%` }} />)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="text-[15px] font-semibold">최근 자동 작업</h2>
        {u.jobs.length === 0 ? (
          <p className="mt-1 text-[13px] text-muted">기록이 없어요. Vercel에 CRON_SECRET·SUPABASE_SERVICE_ROLE_KEY가 들어 있는지, Vercel → Cron Jobs에서 실행 기록을 확인하세요.</p>
        ) : (
          <ul className="mt-2 grid gap-1 text-[13px]">
            {u.jobs.map((j, k) => (
              <li key={k} className="flex flex-wrap gap-2">
                <span className={j.ok ? "text-teal" : "font-semibold text-pin"}>{j.ok ? "✓" : "✕"}</span>
                <span>{when(j.ran_at)}</span>
                <span className="break-all text-muted">{j.detail ? JSON.stringify(j.detail) : ""}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function Box({ title, value, hint, warn }: { title: string; value: string; hint?: string; warn?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${warn ? "border-pin" : "border-rule"}`}>
      <p className="text-[12px] text-muted">{title}</p>
      <p className={`text-[22px] font-semibold ${warn ? "text-pin" : ""}`}>{value}</p>
      {hint && <p className="text-[12px] text-muted">{hint}</p>}
    </div>
  );
}

// ── 오류: 화면·서버에서 난 오류(같은 오류는 묶어서 횟수) ──────────
type Err = { fingerprint: string; source: "client" | "server"; message: string; stack: string | null; url: string | null; user_agent: string | null; count: number; first_at: string; last_at: string; resolved: boolean };

export function ErrorsPanel() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<Err[] | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const load = useCallback(async () => {
    let q = supabase.from("error_logs").select("*").order("last_at", { ascending: false }).limit(200);
    if (!showResolved) q = q.eq("resolved", false);
    const { data } = await q;
    setRows((data as Err[]) ?? []);
  }, [supabase, showResolved]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function resolve(fp: string | null, v = true) {
    const q = supabase.from("error_logs").update({ resolved: v });
    await (fp ? q.eq("fingerprint", fp) : q.eq("resolved", false));
    load();
  }

  if (!rows) return <p className="text-muted">불러오는 중…</p>;
  return (
    <section className="grid gap-3">
      <p className="text-[13px] text-muted">
        사용자 화면(client)과 서버(server)에서 난 오류예요. 같은 오류는 한 줄로 묶어 횟수만 늘고, 처음 보는 오류가 생기면 운영자에게 알림이 가요. 고친 뒤 ‘해결’로 표시하면 다시 나면
        목록에 돌아와요.
      </p>
      <div className="flex flex-wrap items-center gap-3 text-[14px]">
        <label className="flex items-center gap-2"><input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} /> 해결한 것도 보기</label>
        {rows.some((r) => !r.resolved) && <ConfirmButton label="모두 해결로" question="보이는 오류를 모두 해결로 표시할까요?" confirmLabel="표시" onConfirm={() => resolve(null)} />}
      </div>
      {rows.length === 0 && <p className="text-[14px] text-muted">오류가 없어요. 🎉</p>}
      <ul className="grid gap-2">
        {rows.map((r) => (
          <li key={r.fingerprint} className={`rounded-xl border p-3 text-[13px] ${r.resolved ? "border-rule opacity-60" : "border-pin/50"}`}>
            <p className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-[11px] text-white ${r.source === "server" ? "bg-ink" : "bg-teal"}`}>{r.source === "server" ? "서버" : "화면"}</span>
              <b className="break-all">{r.message}</b>
            </p>
            <p className="mt-1 text-[12px] text-muted">
              {num(r.count)}번 · 처음 {when(r.first_at)} · 마지막 {when(r.last_at)}
              {r.url && <> · <span className="break-all">{r.url}</span></>}
            </p>
            <div className="mt-1 flex gap-3 text-[12px]">
              <button type="button" onClick={() => setOpen(open === r.fingerprint ? null : r.fingerprint)} className="underline">{open === r.fingerprint ? "접기" : "자세히"}</button>
              <button type="button" onClick={() => resolve(r.fingerprint, !r.resolved)} className="text-teal underline">{r.resolved ? "다시 열기" : "해결"}</button>
            </div>
            {open === r.fingerprint && (
              <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-surface p-2 text-[11px]">{`${r.stack ?? "(스택 없음)"}\n\n${r.user_agent ?? ""}`}</pre>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}


// ── 구글 장소 기능 스위치: 끄면 사이트가 구글 장소 검색·카드·좌표 찾기를 부르지 않는다 ──────────
// "예산 넘으면 자동으로 끄기"가 켜져 있으면, 이번 달 추정 요금이 구글 예산에 닿을 때 DB가 스스로 끄고 운영자에게 알린다.
type Flag = { enabled?: boolean; auto_off?: boolean; reason?: string | null; changed_at?: string; cost?: number; budget?: number };
function GoogleSwitch() {
  const supabase = useMemo(() => createClient(), []);
  const [flag, setFlag] = useState<Flag | null>(null);
  const [msg, setMsg] = useState("");
  const load = useCallback(async () => {
    const { data } = await supabase.from("app_flags").select("value").eq("key", "google_places").maybeSingle();
    setFlag((data?.value as Flag) ?? { enabled: true, auto_off: true });
  }, [supabase]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function save(patch: Flag) {
    const value = { ...flag, ...patch, changed_at: new Date().toISOString() };
    // 손으로 켜고 끄면 자동으로 꺼진 사유는 지운다
    if ("enabled" in patch) value.reason = patch.enabled ? null : "manual";
    const { error } = await supabase.from("app_flags").update({ value, updated_at: new Date().toISOString() }).eq("key", "google_places");
    setMsg(error ? "저장하지 못했어요." : "저장했어요. 이미 열려 있는 화면은 새로 고치면 반영돼요.");
    load();
  }

  if (!flag) return null;
  const on = flag.enabled !== false;
  return (
    <div className={`rounded-xl border p-4 ${on ? "border-rule" : "border-pin bg-pin/5"}`}>
      <div className="flex flex-wrap items-center gap-3">
        <b className="flex-1 text-[15px]">구글 장소 기능 {on ? "켜짐" : "꺼짐"}</b>
        <ConfirmButton
          label={on ? "끄기" : "다시 켜기"}
          question={on ? "구글 장소 기능을 끌까요? 장소 검색·장소 카드·가게 찾기가 멈추고, 이미 담긴 장소와 지도는 그대로 보여요." : "구글 장소 기능을 다시 켤까요? 요금이 다시 나가기 시작해요."}
          confirmLabel={on ? "끄기" : "켜기"}
          onConfirm={() => save({ enabled: !on })}
          className={on ? "btn-quiet !text-pin" : "btn-primary"}
        />
      </div>
      {!on && (
        <p className="mt-2 text-[13px] text-pin">
          {flag.reason === "budget"
            ? `예산 때문에 자동으로 꺼졌어요${flag.changed_at ? ` (${when(flag.changed_at)})` : ""}: 이번 달 추정 $${num(flag.cost, 2)} / 예산 $${num(flag.budget, 2)}. 예산을 올리거나 다음 달이 된 뒤 다시 켜세요(켠 뒤에도 예산을 넘은 상태면 곧 다시 꺼져요).`
            : `손으로 껐어요${flag.changed_at ? ` (${when(flag.changed_at)})` : ""}.`}
        </p>
      )}
      <label className="mt-3 flex items-center gap-2 text-[14px]">
        <input type="checkbox" checked={flag.auto_off !== false} onChange={(e) => save({ auto_off: e.target.checked })} />
        예산 넘으면 자동으로 끄기 <span className="text-[12px] text-muted">(아래 &lsquo;구글 지도&rsquo; 한 달 예산 기준, 예산이 0이면 꺼지지 않음)</span>
      </label>
      <p className="mt-2 text-[12px] text-muted">
        이 스위치는 PinWith가 센 사용량으로 판단해요. 구글이 실제 청구액으로 직접 멈추게 하려면 저장소의 scripts/gcp/stop-places-on-budget.sh를 구글 클라우드 셸에서 한 번 실행해 두세요.
      </p>
      {msg && <p role="status" className="mt-1 text-[13px] text-teal">{msg}</p>}
    </div>
  );
}


// ── 로그인 방식: Supabase → Authentication → Providers에 설정을 마친 회사만 켠다 ──────────
const LOGINS = [
  // Apple은 Apple Developer Program(연 $99, iOS 앱 낼 때 가입) 뒤에 켠다
  { key: "apple", label: "Apple(개발자 가입 뒤)" },
  { key: "facebook", label: "Facebook(Meta)" },
] as const;
function LoginSwitch() {
  const supabase = useMemo(() => createClient(), []);
  const [v, setV] = useState<Record<string, boolean> | null>(null);
  const [msg, setMsg] = useState("");
  const load = useCallback(async () => {
    const { data } = await supabase.from("app_flags").select("value").eq("key", "login").maybeSingle();
    setV((data?.value as Record<string, boolean>) ?? {});
  }, [supabase]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);
  async function toggle(key: string, on: boolean) {
    const { error } = await supabase.from("app_flags").update({ value: { ...v, [key]: on }, updated_at: new Date().toISOString() }).eq("key", "login");
    setMsg(error ? "저장하지 못했어요." : "저장했어요. 로그인 화면을 새로 열면 반영돼요.");
    load();
  }
  if (!v) return null;
  return (
    <div className="rounded-xl border border-rule p-4">
      <b className="text-[15px]">로그인 방식</b>
      <span className="ml-2 text-[12px] text-muted">구글·이메일은 늘 켜져 있어요. Supabase에 설정을 마친 뒤 켜고, 시험 로그인을 꼭 해 보세요.</span>
      <div className="mt-2 flex flex-wrap gap-4 text-[14px]">
        {LOGINS.map((l) => (
          <label key={l.key} className="flex items-center gap-2">
            <input type="checkbox" checked={!!v[l.key]} onChange={(e) => toggle(l.key, e.target.checked)} />
            {l.label}
          </label>
        ))}
      </div>
      {msg && <p role="status" className="mt-1 text-[13px] text-teal">{msg}</p>}
    </div>
  );
}
