"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useMonetization } from "@/lib/monetization";
import { ConfirmButton, count, DetailHeader, money, Msg, MODEL, Period, Stat, Tabs, useAuthed, useConsoleNav } from "./ui";

type Tab = "display" | "market" | "mine" | "stores" | "payout";
const TABS: { id: Tab; label: string }[] = [
  { id: "display", label: "디스플레이 광고" },
  { id: "market", label: "가게 제휴 찾기" },
  { id: "mine", label: "내 제휴 성과" },
  { id: "stores", label: "연결된 가게" },
  { id: "payout", label: "지급" },
];

type Dash = {
  currency: string; est_rpm: number; rate_pct: number; platform_fee_pct: number; min_payout: number; eligible: boolean;
  lists: { id: string; title: string; slug: string; monetize: boolean; visibility: string; paid_month: number; all_month: number; all_30d: number; est_month: number }[];
  display_total: number; offer_total: number; offer_month: number; reservation_month: number; reservations_month: number;
  reservations_confirmed_month: number; requested: number; paid: number; available: number; has_profile: boolean;
};

// 큐레이터 콘솔: 수익화 기준을 넘은 큐레이터만. 디스플레이 광고 예상 수익, 가게 제휴 고르기·성과, 연결된 가게, 지급.
export function CuratorConsole() {
  const { user, supabase } = useAuthed("/biz/curator");
  const nav = useConsoleNav<Tab>("display");
  const m = useMonetization(!!user);
  const [dash, setDash] = useState<Dash | null>(null);
  const reload = useCallback(async () => {
    const { data } = await supabase.rpc("curator_dashboard");
    setDash(data as Dash);
  }, [supabase]);
  useEffect(() => {
    // 로그인 확인 뒤 한 번 읽는다
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (user) reload();
  }, [user, reload]);

  if (!user || !dash || !m) return <p className="text-muted">불러오는 중…</p>;

  // 기준 미달: 콘솔 내용은 보여 주지 않고 기준만 알려 준다
  if (!dash.eligible)
    return (
      <section className="mx-auto max-w-[560px]">
        <h1 className="font-display text-[26px] font-semibold text-ink">큐레이터 콘솔</h1>
        <div className="mt-5 rounded-xl border border-rule p-5">
          <p className="text-[16px] font-semibold text-ink">아직 상업 큐레이터 기준에 이르지 않아 콘솔을 볼 수 없어요.</p>
          <p className="mt-2 text-[14px] text-ink/80">아래 둘 중 하나를 넘으면 열려요.</p>
          <ul className="mt-3 grid gap-2 text-[14px]">
            <li className="rounded-lg bg-surface px-3 py-2">
              팔로워 <b>{count(m.min_followers)}명</b> 이상 <span className="text-muted">— 지금 {count(m.followers)}명</span>
            </li>
            <li className="rounded-lg bg-surface px-3 py-2">
              최근 30일 동안 내 리스트의 광고 자리가 실제로 보인 횟수 <b>{count(m.min_ad_views_30d)}회</b> 이상 <span className="text-muted">— 지금 {count(m.views_30d)}회</span>
            </li>
          </ul>
          <p className="mt-3 text-[12px] text-muted">
            ‘실제로 보인 횟수’는 광고 자리가 화면에 절반 이상 1초 넘게 보인 경우만 세요(같은 사람이 30분 안에 다시 본 것, 내가·공동 편집자가 본 것은 빼요). 기준을 넘으면 알림 맨
            위에 안내가 떠요.
          </p>
          <Link href="/" className="btn-quiet mt-4 inline-flex">지도로 돌아가기</Link>
        </div>
      </section>
    );

  if (nav.detail) return <CuratorDetail dash={dash} kind={nav.detail} onBack={nav.back} />;

  return (
    <div>
      <h1 className="font-display text-[26px] font-semibold text-ink">큐레이터 콘솔</h1>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="받을 수 있는 금액" value={money(dash.available, dash.currency)} hint={`최소 ${money(dash.min_payout, dash.currency)}부터 요청`} onClick={() => nav.open("available")} />
        <Stat label="이번 달 광고 예상" value={money(dash.lists.filter((l) => l.monetize).reduce((s, l) => s + Number(l.est_month), 0), dash.currency)} hint="수익화한 리스트" onClick={() => nav.open("display")} />
        <Stat label="이번 달 길찾기·방문 제휴" value={money(dash.offer_month, dash.currency)} onClick={() => nav.open("traffic")} />
        <Stat
          label="이번 달 예약 제휴"
          value={money(dash.reservation_month, dash.currency)}
          hint={`예약 문의 ${count(dash.reservations_month)}건 · 확정 ${count(dash.reservations_confirmed_month)}건`}
          onClick={() => nav.open("reservation")}
        />
        <Stat label="지급 받은 금액" value={money(dash.paid, dash.currency)} hint={dash.requested > 0 ? `요청 중 ${money(dash.requested, dash.currency)}` : undefined} onClick={() => nav.open("paid")} />
      </div>
      <div className="mt-6">
        <Tabs tabs={TABS} value={nav.tab} onChange={nav.setTab} />
      </div>
      <div className="mt-5">
        {nav.tab === "display" && <Display dash={dash} reload={reload} />}
        {nav.tab === "market" && <Market currency={dash.currency} />}
        {nav.tab === "mine" && <Mine currency={dash.currency} />}
        {nav.tab === "stores" && <Stores currency={dash.currency} />}
        {nav.tab === "payout" && <Payout dash={dash} reload={reload} />}
      </div>
    </div>
  );
}

// ── 대시보드 상자 상세 ─────────────────────────
type MyCharge = { at: string; place_name: string; list_title: string | null; model: string; amount: number };
type PayoutRow = { month: string; amount: number; currency: string; views: number };

function CuratorDetail({ dash, kind, onBack }: { dash: Dash; kind: string; onBack: () => void }) {
  const { user, supabase } = useAuthed("/biz/curator");
  const [charges, setCharges] = useState<MyCharge[] | null>(null);
  const [display, setDisplay] = useState<PayoutRow[]>([]);
  const [reqs, setReqs] = useState<Req[]>([]);
  const load = useCallback(async () => {
    if (!user) return;
    const month = kind === "traffic" || kind === "reservation";
    const [{ data: c }, { data: p }, { data: r }] = await Promise.all([
      supabase.rpc("my_charges", { p_days: month ? 31 : 365, p_model: kind === "traffic" ? "traffic" : kind === "reservation" ? "reservation" : null }),
      supabase.from("payouts").select("month, amount, currency, views").eq("user_id", user.id).order("month", { ascending: false }),
      supabase.from("payout_requests").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);
    const m0 = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
    setCharges(((c as MyCharge[]) ?? []).filter((x) => !month || new Date(x.at).getTime() >= m0));
    setDisplay((p as PayoutRow[]) ?? []);
    setReqs((r as Req[]) ?? []);
  }, [supabase, user, kind]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const titles: Record<string, string> = {
    available: "받을 수 있는 금액", display: "이번 달 광고 예상", traffic: "이번 달 길찾기·방문 제휴", reservation: "이번 달 예약 제휴", paid: "지급 받은 금액",
  };
  const chargeTable = (rows: MyCharge[]) =>
    rows.length === 0 ? (
      <p className="mt-2 text-[14px] text-muted">아직 없어요.</p>
    ) : (
      <table className="mt-2 w-full text-left text-[14px]">
        <thead className="border-b border-rule text-[12px] text-muted">
          <tr><th className="py-2">때</th><th>가게 · 리스트</th><th>종류</th><th className="text-right">내 몫</th></tr>
        </thead>
        <tbody>
          {rows.map((c, i) => (
            <tr key={i} className="border-b border-rule">
              <td className="py-1.5 text-[13px] tabular-nums">{new Date(c.at).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" })}</td>
              <td className="text-[13px]"><b>{c.place_name}</b>{c.list_title && <span className="text-muted"> · {c.list_title}</span>}</td>
              <td className="text-[13px]">{MODEL[c.model]?.label.replace(/ 1(회|건)당/, "")}{Number(c.amount) < 0 && " (노쇼·취소로 되돌림)"}</td>
              <td className={`text-right tabular-nums ${Number(c.amount) < 0 ? "text-pin" : ""}`}>{money(c.amount, dash.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );

  return (
    <div className="grid gap-4">
      <DetailHeader title={titles[kind] ?? "자세히"} onBack={onBack} />
      {kind === "display" && <Display dash={dash} reload={() => {}} />}
      {(kind === "traffic" || kind === "reservation") && (
        <section>
          <p className="text-[13px] text-muted">
            {kind === "traffic" ? "이번 달 길찾기·지도 열기와 가게 근처 누름으로 쌓인 제휴 수익이에요." : "이번 달 예약 확정으로 쌓인 수익이에요. 확정 뒤 노쇼·취소가 되면 되돌려져요."}
          </p>
          {charges ? chargeTable(charges) : <p className="text-muted">불러오는 중…</p>}
        </section>
      )}
      {kind === "available" && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="확정된 광고 정산" value={money(dash.display_total, dash.currency)} />
            <Stat label="제휴 수익(누적)" value={money(dash.offer_total, dash.currency)} />
            <Stat label="요청·지급한 금액" value={money(Number(dash.requested) + Number(dash.paid), dash.currency)} />
            <Stat label="받을 수 있는 금액" value={money(dash.available, dash.currency)} />
          </div>
          <section>
            <h3 className="text-[15px] font-semibold">월별 광고 정산</h3>
            {display.length === 0 ? (
              <p className="mt-2 text-[14px] text-muted">아직 확정된 달이 없어요.</p>
            ) : (
              <ul className="mt-2 divide-y divide-rule text-[14px]">
                {display.map((p) => (
                  <li key={p.month} className="flex gap-2 py-2"><span className="flex-1">{p.month.slice(0, 7)} · 노출 {count(p.views)}회</span><b>{money(p.amount, p.currency)}</b></li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h3 className="text-[15px] font-semibold">제휴 수익 기록(최근 1년)</h3>
            {charges ? chargeTable(charges) : <p className="text-muted">불러오는 중…</p>}
          </section>
        </>
      )}
      {kind === "paid" && (
        <section>
          {reqs.length === 0 ? (
            <p className="text-[14px] text-muted">아직 지급 요청이 없어요.</p>
          ) : (
            <ul className="divide-y divide-rule text-[14px]">
              {reqs.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-2 py-2">
                  <span className="tabular-nums">{new Date(r.created_at).toLocaleDateString("ko-KR")}</span>
                  <b className="tabular-nums">{money(r.amount, r.currency)}</b>
                  <span className={r.status === "paid" ? "text-teal" : r.status === "rejected" ? "text-pin" : "text-muted"}>
                    {r.status === "paid" ? `지급함${r.paid_at ? ` (${new Date(r.paid_at).toLocaleDateString("ko-KR")})` : ""}` : r.status === "rejected" ? "반려" : "처리 중"}
                  </span>
                  {r.note && <span className="text-[12px] text-muted">{r.note}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

// ── 디스플레이 광고 ─────────────────────────
function Display({ dash, reload }: { dash: Dash; reload: () => void }) {
  const m = useMonetization();
  const { supabase } = useAuthed("/biz/curator");
  const [msg, setMsg] = useState("");

  async function toggle(id: string, on: boolean) {
    const { error } = await supabase.from("lists").update({ monetize: on }).eq("id", id);
    setMsg(error ? (error.message.includes("eligible") ? "아직 수익화 기준에 이르지 않았어요." : "바꾸지 못했어요.") : on ? "수익화를 켰어요." : "수익화를 껐어요.");
    reload();
  }

  return (
    <section className="grid gap-4">
      {!dash.eligible && m && (
        <div className="rounded-xl bg-surface p-4 text-[14px] text-ink">
          <p className="font-semibold">아직 수익화 기준 전이에요</p>
          <p className="mt-1 text-ink/80">
            팔로워 {count(m.followers)} / {count(m.min_followers)}명 또는 최근 30일 광고 노출 {count(m.views_30d)} / {count(m.min_ad_views_30d)}회 중 하나를 넘으면
            수익화를 켤 수 있어요.
          </p>
        </div>
      )}
      <p className="text-[13px] text-muted">
        예상 수익 = 이번 달 실제 광고 노출 ÷ 1,000 × 예상 단가 {money(dash.est_rpm, dash.currency)} × 내 분배율 {dash.rate_pct}%. 실제 금액은 달이 끝나고 광고 수익이
        확정되면 정해져요. 지금 나오는 PinWith 자체 홍보는 노출에는 세지만 수익에는 들어가지 않아요.
      </p>
      <Msg text={msg} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-[14px]">
          <thead className="border-b border-rule text-[12px] text-muted">
            <tr>
              <th className="py-2">리스트</th>
              <th>수익화</th>
              <th>이번 달 광고 노출</th>
              <th>최근 30일 노출(홍보 포함)</th>
              <th>이번 달 예상</th>
            </tr>
          </thead>
          <tbody>
            {dash.lists.map((l) => (
              <tr key={l.id} className="border-b border-rule">
                <td className="py-2">
                  <Link href={`/me/lists/${l.id}`} className="font-semibold">{l.title}</Link>
                  {l.visibility === "private" && <span className="ml-1 text-[12px] text-muted">나만 보기</span>}
                </td>
                <td>
                  {dash.eligible || l.monetize ? (
                    <label className="inline-flex items-center gap-2">
                      <input type="checkbox" checked={l.monetize} onChange={(e) => toggle(l.id, e.target.checked)} className="h-5 w-5 accent-[var(--color-pin)]" />
                      {l.monetize ? "켬" : "끔"}
                    </label>
                  ) : (
                    <span className="text-muted">–</span>
                  )}
                </td>
                <td className="tabular-nums">{count(l.paid_month)}</td>
                <td className="tabular-nums">{count(l.all_30d)}</td>
                <td className="font-semibold tabular-nums">{l.monetize ? money(l.est_month, dash.currency) : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}


// ── 가게 제휴 찾기 ─────────────────────────
type Offer = {
  offer_id: string; model: string; rate: number; curator_rate: number; message: string | null; business: string;
  place_id: string; place_name: string; place_address: string | null; budget_left: number | null; mine: boolean;
  my_items: { list_id: string; list_title: string; item_id: string; visibility: string; attached: boolean; attachment_id: string | null; paid_only: boolean }[];
};
type MyList = { id: string; title: string };

function Market({ currency }: { currency: string }) {
  const { user, supabase } = useAuthed("/biz/curator");
  const [rows, setRows] = useState<Offer[] | null>(null);
  const [lists, setLists] = useState<MyList[]>([]);
  const [onlyMine, setOnlyMine] = useState(false);
  const [paidOnly, setPaidOnly] = useState<Record<string, boolean>>({});
  const [pick, setPick] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const load = useCallback(async () => {
    if (!user) return;
    const [{ data }, { data: ls }] = await Promise.all([
      supabase.rpc("offer_market"),
      supabase.from("lists").select("id, title").eq("owner_id", user.id).neq("visibility", "private").order("title"),
    ]);
    setRows((data as Offer[]) ?? []);
    setLists((ls as MyList[]) ?? []);
  }, [supabase, user]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function attach(o: Offer, it: Offer["my_items"][number]) {
    if (!user) return;
    const po = !!paidOnly[o.offer_id];
    const { error } = await supabase
      .from("offer_attachments")
      .upsert({ offer_id: o.offer_id, list_id: it.list_id, item_id: it.item_id, curator_id: user.id, active: true }, { onConflict: "offer_id,list_id" });
    if (!error && po !== it.paid_only) await supabase.from("list_items").update({ paid_only: po }).eq("id", it.item_id);
    setMsg(error ? "붙이지 못했어요. 리스트가 공개 또는 링크 공개인지 확인하세요." : `‘${it.list_title}’에 ${o.place_name} 제휴를 붙였어요.`);
    load();
  }
  async function detach(o: Offer, it: Offer["my_items"][number]) {
    if (!it.attachment_id) return;
    const { error } = await supabase.from("offer_attachments").update({ active: false }).eq("id", it.attachment_id);
    setMsg(error ? "해제하지 못했어요." : `‘${it.list_title}’에서 ${o.place_name} 제휴를 해제했어요. 이미 쌓인 수익은 그대로예요.`);
    load();
  }
  async function addAndAttach(o: Offer) {
    const listId = pick[o.offer_id] || lists[0]?.id;
    if (!listId) return setMsg("공개 또는 링크 공개 리스트가 있어야 담을 수 있어요.");
    const { error } = await supabase.rpc("add_place_and_attach", { p_offer: o.offer_id, p_list: listId, p_paid_only: !!paidOnly[o.offer_id] });
    const t = lists.find((l) => l.id === listId)?.title;
    setMsg(error ? (error.message.includes("blocked") ? "이 가게가 나를 차단해서 담을 수 없어요." : "담지 못했어요.") : `${o.place_name}을(를) ‘${t}’에 담고 제휴를 붙였어요.`);
    load();
  }

  if (!rows) return <p className="text-muted">불러오는 중…</p>;
  const shown = onlyMine ? rows.filter((r) => r.mine) : rows;
  return (
    <section className="grid gap-4">
      <p className="text-[13px] text-muted">
        가게들이 내건 보상 조건이에요. 붙인 뒤부터 조건에 맞는 손님 행동마다 수익이 쌓여요(같은 사람은 하루 1회, 나와 가게 주인 본인은 제외). 표시된 금액은 PinWith 수수료를 뺀
        내 몫이에요. 내 리스트에 없는 가게는 여기서 바로 담고 붙일 수 있어요.
      </p>
      <label className="flex items-center gap-2 text-[14px]">
        <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} /> 내 리스트에 있는 가게만
      </label>
      <Msg text={msg} />
      {shown.length === 0 && <p className="text-[14px] text-muted">아직 제휴 조건을 내건 가게가 없어요.</p>}
      <ul className="grid gap-3 md:grid-cols-2">
        {shown.map((o) => (
          <li key={o.offer_id} className="rounded-xl border border-rule p-4">
            <p className="text-[16px] font-semibold text-ink">{o.place_name}</p>
            <p className="text-[12px] text-muted">{o.business}{o.place_address ? ` · ${o.place_address}` : ""}</p>
            <p className="mt-2 text-[15px]">
              <b className="text-pin">{money(o.curator_rate, currency)}</b> <span className="text-ink/80">· {MODEL[o.model]?.label}</span>
            </p>
            <p className="text-[12px] text-muted">{MODEL[o.model]?.desc}</p>
            {o.budget_left != null && <p className="text-[12px] text-muted">이번 달 남은 예산 {money(o.budget_left, currency)}</p>}
            {o.message && <p className="mt-2 rounded-lg bg-surface px-3 py-2 text-[13px] text-ink/80">{o.message}</p>}
            <label className="mt-3 flex items-start gap-2 text-[13px]">
              <input type="checkbox" checked={!!paidOnly[o.offer_id]} onChange={(e) => setPaidOnly({ ...paidOnly, [o.offer_id]: e.target.checked })} className="mt-0.5" />
              <span>
                광고비 지급될 때만 공개
                <span className="block text-[12px] text-muted">가게 잔액이 모자라면 내 리스트에서 이 가게를 숨겨요. 끄면 잔액과 관계없이 계속 보여요.</span>
              </span>
            </label>
            <div className="mt-3 grid gap-1.5">
              {o.my_items.length === 0 ? (
                lists.length === 0 ? (
                  <p className="text-[13px] text-muted">공개 또는 링크 공개 리스트가 있어야 담을 수 있어요.</p>
                ) : (
                  <div className="flex flex-wrap items-center gap-2 text-[14px]">
                    <select value={pick[o.offer_id] ?? lists[0].id} onChange={(e) => setPick({ ...pick, [o.offer_id]: e.target.value })} className="field !w-auto min-w-0 flex-1 !py-1">
                      {lists.map((l) => (
                        <option key={l.id} value={l.id}>{l.title}</option>
                      ))}
                    </select>
                    <button type="button" onClick={() => addAndAttach(o)} className="btn-primary !px-3 !py-1 !text-[13px]">담고 붙이기</button>
                  </div>
                )
              ) : (
                o.my_items.map((it) => (
                  <div key={it.list_id} className="flex items-center gap-2 text-[14px]">
                    <span className="min-w-0 flex-1 truncate">
                      {it.list_title}
                      {it.paid_only && <span className="ml-1 text-[11px] text-muted">지급될 때만 공개</span>}
                    </span>
                    {it.attached ? (
                      <>
                        <span className="text-[13px] text-teal">붙임 ✓</span>
                        <button type="button" onClick={() => detach(o, it)} className="btn-quiet !px-2.5 !py-1 !text-[12px]">해제</button>
                      </>
                    ) : it.visibility === "private" ? (
                      <span className="text-[12px] text-muted">나만 보기 리스트</span>
                    ) : (
                      <button type="button" onClick={() => attach(o, it)} className="btn-primary !px-3 !py-1 !text-[13px]">붙이기</button>
                    )}
                  </div>
                ))
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── 내 제휴 성과 ─────────────────────────
type MineRow = {
  attachment_id: string; active: boolean; offer_active: boolean; model: string; curator_rate: number; place_name: string; business: string;
  list_id: string; list_title: string; item_id: string; paid_only: boolean | null; count: number; inquiries: number; earned: number; earned_total: number;
};

function Mine({ currency }: { currency: string }) {
  const { supabase } = useAuthed("/biz/curator");
  const [days, setDays] = useState(30);
  const [rows, setRows] = useState<MineRow[] | null>(null);
  const load = useCallback(async () => {
    const { data } = await supabase.rpc("my_offer_stats", { p_days: days });
    setRows((data as MineRow[]) ?? []);
  }, [supabase, days]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function setActive(r: MineRow, on: boolean) {
    await supabase.from("offer_attachments").update({ active: on }).eq("id", r.attachment_id);
    load();
  }
  async function setPaidOnly(r: MineRow, on: boolean) {
    await supabase.from("list_items").update({ paid_only: on }).eq("id", r.item_id);
    load();
  }

  if (!rows) return <p className="text-muted">불러오는 중…</p>;
  return (
    <section className="grid gap-4">
      <div className="flex items-center gap-3">
        <Period value={days} onChange={setDays} />
        <span className="text-[13px] text-muted">
          {days}일 수익 {money(rows.reduce((s, r) => s + Number(r.earned), 0), currency)}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="text-[14px] text-muted">아직 붙인 제휴가 없어요. ‘가게 제휴 찾기’에서 골라 보세요.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[14px]">
            <thead className="border-b border-rule text-[12px] text-muted">
              <tr>
                <th className="py-2">가게 · 리스트</th>
                <th>조건(내 몫)</th>
                <th>{days}일 횟수</th>
                <th>{days}일 수익</th>
                <th>누적</th>
                <th>수익화</th>
                <th>지급될 때만 공개</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.attachment_id} className="border-b border-rule">
                  <td className="py-2">
                    <b>{r.place_name}</b>
                    <span className="block text-[12px] text-muted">{r.list_title}</span>
                  </td>
                  <td className="text-[13px]">
                    {money(r.curator_rate, currency)} · {MODEL[r.model]?.label}
                    {!r.offer_active && <span className="block text-[12px] text-pin">가게가 조건을 내렸어요</span>}
                  </td>
                  <td className="tabular-nums">
                    {count(r.count)}
                    {r.model === "reservation" && <span className="block text-[11px] text-muted">문의 {count(r.inquiries)}건</span>}
                  </td>
                  <td className="font-semibold tabular-nums">{money(r.earned, currency)}</td>
                  <td className="tabular-nums">{money(r.earned_total, currency)}</td>
                  <td>
                    <label className="inline-flex items-center gap-1.5">
                      <input type="checkbox" checked={r.active} onChange={(e) => setActive(r, e.target.checked)} className="h-5 w-5 accent-[var(--color-pin)]" />
                      {r.active ? "켬" : "해제"}
                    </label>
                  </td>
                  <td>
                    <input type="checkbox" checked={!!r.paid_only} onChange={(e) => setPaidOnly(r, e.target.checked)} className="h-5 w-5 accent-[var(--color-pin)]" aria-label="광고비 지급될 때만 공개" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ── 연결된 가게: 가게별 통계(예약 확정·방문·노쇼·취소, 주변 평균 비교), 연결 끊기 ─────────────────────────
type Store = {
  business_id: string; place_name: string; business: string;
  attachments: { attachment_id: string; model: string; list_title: string; active: boolean; item_id: string }[];
  inquiries: number; confirmed: number; visited: number; no_show: number; cancel_business: number; cancel_guest: number;
  store_rate: number | null; store_confirmed: number; peer_rate: number; clicks: number; earned: number; alerted_at: string | null;
};

function Stores({ currency }: { currency: string }) {
  const { supabase } = useAuthed("/biz/curator");
  const [rows, setRows] = useState<Store[] | null>(null);
  const [msg, setMsg] = useState("");
  const load = useCallback(async () => {
    const { data } = await supabase.rpc("my_connected_stores", { p_days: 90 });
    setRows((data as Store[]) ?? []);
  }, [supabase]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  // 연결 끊기: 제휴를 해제하고 그 가게를 내 리스트에서도 뺀다(이미 쌓인 수익은 그대로)
  async function disconnect(s: Store) {
    const items = [...new Set(s.attachments.map((a) => a.item_id).filter(Boolean))];
    const { error } = items.length ? await supabase.from("list_items").delete().in("id", items) : { error: null };
    setMsg(error ? "끊지 못했어요." : `${s.place_name} 연결을 끊고 내 리스트에서 뺐어요.`);
    load();
  }

  if (!rows) return <p className="text-muted">불러오는 중…</p>;
  const pct = (v: number | null) => (v == null ? "–" : `${Math.round(v * 100)}%`);
  return (
    <section className="grid gap-4">
      <p className="text-[13px] text-muted">
        최근 90일 동안 내 리스트를 통해 연결된 가게들이에요. 노쇼·취소는 가게가 알려 준 대로 반영하되, 그 비율이 반경 3km 안 다른 가게들보다 눈에 띄게 높으면 알림으로 알려 드려요.
        이상하다고 생각되면 연결을 끊을 수 있고, 끊으면 그 가게가 내 리스트에서도 빠져요.
      </p>
      <Msg text={msg} />
      {rows.length === 0 && <p className="text-[14px] text-muted">아직 연결된 가게가 없어요.</p>}
      <ul className="grid gap-3 lg:grid-cols-2">
        {rows.map((s) => {
          const odd = s.store_rate != null && s.store_confirmed >= 5 && s.store_rate >= Math.max(s.peer_rate * 2, s.peer_rate + 0.2);
          const active = s.attachments.some((a) => a.active);
          return (
            <li key={s.business_id} className={`rounded-xl border p-4 ${odd ? "border-pin" : "border-rule"}`}>
              <p className="flex items-center gap-2">
                <b className="text-[16px]">{s.place_name}</b>
                {odd && <span className="rounded-full bg-pin px-2 py-0.5 text-[11px] text-white">확인 필요</span>}
                {!active && <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] text-muted">연결 끊김</span>}
              </p>
              <p className="text-[12px] text-muted">
                {s.attachments.map((a) => `${a.list_title} · ${MODEL[a.model]?.label.replace(/ 1(회|건)당/, "")}${a.active ? "" : "(해제)"}`).join(" / ")}
              </p>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-[13px] sm:grid-cols-6">
                {[
                  ["예약 문의", s.inquiries], ["확정", s.confirmed], ["방문", s.visited], ["노쇼", s.no_show], ["가게 취소", s.cancel_business], ["손님 취소", s.cancel_guest],
                ].map(([k, v]) => (
                  <div key={k as string} className="rounded-lg bg-surface px-1 py-2">
                    <dt className="text-[11px] text-muted">{k}</dt>
                    <dd className="font-semibold tabular-nums">{count(v as number)}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-2 text-[13px]">
                이 가게 전체 노쇼·가게 취소 비율 <b className={odd ? "text-pin" : ""}>{pct(s.store_rate)}</b>
                <span className="text-muted"> (확정 {count(s.store_confirmed)}건 기준) · 주변 평균 {pct(s.peer_rate)}</span>
              </p>
              <p className="text-[13px] text-muted">길찾기·방문 과금 {count(s.clicks)}회 · 90일 내 몫 {money(s.earned, currency)}</p>
              {s.alerted_at && <p className="text-[12px] text-pin">{new Date(s.alerted_at).toLocaleDateString("ko-KR")}에 이상 패턴 알림을 보냈어요.</p>}
              <div className="mt-3">
                <ConfirmButton
                  label="이 가게 연결 끊기"
                  className="btn-quiet !px-3 !py-1 !text-[13px]"
                  question={`${s.place_name}과(와)의 제휴를 끊고, 이 가게를 내 리스트(${[...new Set(s.attachments.map((a) => a.list_title))].join(", ")})에서도 뺄까요? 이미 쌓인 수익은 그대로예요.`}
                  confirmLabel="끊고 빼기"
                  onConfirm={() => disconnect(s)}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ── 지급 ─────────────────────────
type Profile = { method: "wise" | "paypal" | "bank"; holder_name: string; email: string; bank_name: string; account_number: string; swift: string; country: string; currency: string };
const EMPTY: Profile = { method: "wise", holder_name: "", email: "", bank_name: "", account_number: "", swift: "", country: "KR", currency: "" };
type Req = { id: string; amount: number; currency: string; status: string; created_at: string; paid_at: string | null; reference: string | null; note: string | null };

function Payout({ dash, reload }: { dash: Dash; reload: () => void }) {
  const { user, supabase } = useAuthed("/biz/curator");
  const [p, setP] = useState<Profile>(EMPTY);
  const [reqs, setReqs] = useState<Req[]>([]);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    const [{ data: prof }, { data: r }] = await Promise.all([
      supabase.from("payout_profiles").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("payout_requests").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);
    if (prof) setP({ ...EMPTY, ...Object.fromEntries(Object.entries(prof).map(([k, v]) => [k, v ?? ""])) } as Profile);
    setReqs((r as Req[]) ?? []);
  }, [supabase, user]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const row = {
      user_id: user.id, method: p.method, holder_name: p.holder_name.trim(),
      email: p.email.trim() || null, bank_name: p.bank_name.trim() || null, account_number: p.account_number.trim() || null,
      swift: p.swift.trim().toUpperCase() || null, country: p.country.trim().toUpperCase().slice(0, 2) || null,
      currency: p.currency.trim().toUpperCase().slice(0, 3) || null, updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("payout_profiles").upsert(row);
    setMsg(error ? "저장하지 못했어요. 칸을 확인하세요." : "지급 정보를 저장했어요.");
    reload();
  }

  async function request() {
    const { data, error } = await supabase.rpc("request_payout");
    if (error) {
      const m = error.message;
      setMsg(m.includes("profile") ? "지급 정보를 먼저 저장하세요." : m.includes("already") ? "처리 중인 요청이 있어요." : m.includes("minimum") ? `최소 ${money(dash.min_payout, dash.currency)}부터 요청할 수 있어요.` : "요청하지 못했어요.");
    } else setMsg(`${money(data as number, dash.currency)} 지급을 요청했어요. 운영자가 확인 후 보내 드려요.`);
    reload();
    load();
  }

  const pending = reqs.some((r) => r.status === "requested");
  const can = dash.has_profile && !pending && dash.available >= dash.min_payout && dash.available > 0;
  const field = (k: keyof Profile, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="grid gap-1 text-[13px] font-semibold">
      {label}
      <input value={p[k]} onChange={(e) => setP({ ...p, [k]: e.target.value })} className="field" {...props} />
    </label>
  );

  return (
    <section className="grid gap-6">
      <div className="rounded-xl border border-rule p-4">
        <p className="text-[14px] text-ink/80">
          받을 수 있는 금액 <b className="text-[20px] text-ink">{money(dash.available, dash.currency)}</b>
          <span className="block text-[12px] text-muted">
            확정된 광고 정산 {money(dash.display_total, dash.currency)} + 제휴 수익 {money(dash.offer_total, dash.currency)} − 요청·지급한 금액
          </span>
        </p>
        <button type="button" onClick={request} disabled={!can} className="btn-primary mt-3 disabled:opacity-40">지급 요청</button>
        {!can && (
          <p className="mt-2 text-[12px] text-muted">
            {!dash.has_profile ? "아래 지급 정보를 먼저 저장하세요." : pending ? "처리 중인 요청이 있어요." : `최소 ${money(dash.min_payout, dash.currency)}부터 요청할 수 있어요.`}
          </p>
        )}
      </div>
      <Msg text={msg} />

      <form onSubmit={save} className="grid max-w-[560px] gap-3">
        <h2 className="text-[17px] font-semibold">지급 받을 정보</h2>
        <p className="text-[12px] text-muted">운영자만 볼 수 있어요. 지급할 때만 써요.</p>
        <label className="grid gap-1 text-[13px] font-semibold">
          받는 방법
          <select value={p.method} onChange={(e) => setP({ ...p, method: e.target.value as Profile["method"] })} className="field">
            <option value="wise">Wise</option>
            <option value="paypal">PayPal</option>
            <option value="bank">은행 계좌</option>
          </select>
        </label>
        {field("holder_name", "받는 사람 이름(실명)", { required: true, autoComplete: "name" })}
        {(p.method === "wise" || p.method === "paypal") && field("email", `${p.method === "wise" ? "Wise" : "PayPal"} 계정 이메일`, { inputMode: "email", required: true })}
        {p.method === "bank" && (
          <>
            {field("bank_name", "은행 이름", { required: true })}
            {field("account_number", "계좌 번호", { required: true, inputMode: "numeric" })}
            {field("swift", "SWIFT/BIC(해외 송금 시)")}
          </>
        )}
        <div className="grid grid-cols-2 gap-3">
          {field("country", "나라 코드(예: KR)", { maxLength: 2 })}
          {field("currency", "받을 통화(예: KRW)", { maxLength: 3 })}
        </div>
        <button className="btn-quiet justify-self-start">저장</button>
      </form>

      {reqs.length > 0 && (
        <div>
          <h2 className="text-[17px] font-semibold">요청 기록</h2>
          <ul className="mt-2 divide-y divide-rule text-[14px]">
            {reqs.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 py-2">
                <span className="tabular-nums">{new Date(r.created_at).toLocaleDateString("ko-KR")}</span>
                <b className="tabular-nums">{money(r.amount, r.currency)}</b>
                <span className={r.status === "paid" ? "text-teal" : r.status === "rejected" ? "text-pin" : "text-muted"}>
                  {r.status === "paid" ? "지급함" : r.status === "rejected" ? "반려" : "처리 중"}
                </span>
                {r.note && <span className="text-[12px] text-muted">{r.note}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
