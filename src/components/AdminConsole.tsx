"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Blocks, BizRefunds, BizReview, Disputes, PayoutRequests, StoreQuality, Topups } from "./AdminCommerce";
import { ErrorsPanel, UsagePanel } from "./AdminOps";
import { ActivityPanel } from "./AdminActivity";
import { ConfirmButton } from "./ConfirmButton";

type Tab = "activity" | "payout" | "curators" | "settings" | "support" | "biz" | "topups" | "requests" | "disputes" | "quality" | "blocks" | "usage" | "errors";
const TABS: { id: Tab; label: string }[] = [
  { id: "activity", label: "리스트 반응" },
  { id: "payout", label: "정산" },
  { id: "requests", label: "지급 요청" },
  { id: "biz", label: "가게 인증" },
  { id: "topups", label: "광고비 충전·환불" },
  { id: "disputes", label: "이의 제기" },
  { id: "quality", label: "예약 품질" },
  { id: "blocks", label: "차단 현황" },
  { id: "curators", label: "큐레이터·분배율" },
  { id: "settings", label: "수익화 기준" },
  { id: "support", label: "문의·신고" },
  { id: "usage", label: "서비스 사용량" },
  { id: "errors", label: "오류" },
];

const num = (v: number | string | null | undefined) => Number(v ?? 0).toLocaleString("ko-KR", { maximumFractionDigits: 2 });

// 운영자 콘솔: 월별 광고 수익 입력 → 큐레이터별 분배 미리보기 → 확정 → 지급 표시, 분배율·기준 관리, 문의·신고 확인.
// 모든 조회·변경은 DB에서 운영자(admins 표)인지 다시 확인한다.
export function AdminConsole() {
  const supabase = useMemo(() => createClient(), []);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  // 알림에서 ?tab=disputes 처럼 바로 들어올 수 있게
  const [tab, setTab] = useState<Tab>(() =>
    typeof window === "undefined" ? "payout" : ((new URLSearchParams(window.location.search).get("tab") as Tab | null) ?? "payout"),
  );

  useEffect(() => {
    supabase.rpc("my_monetization").then(({ data }) => setAllowed(!!(data as { is_admin?: boolean } | null)?.is_admin));
  }, [supabase]);

  if (allowed === null) return <p className="text-muted">확인 중…</p>;
  if (!allowed)
    return (
      <p className="text-ink">
        운영자만 볼 수 있는 화면입니다. <Link href="/login?next=/admin" className="underline">로그인</Link>
      </p>
    );

  return (
    <div>
      <h1 className="font-display text-[26px] font-semibold text-ink">운영자 콘솔</h1>
      <nav className="mt-4 flex flex-wrap gap-2 border-b border-rule pb-3">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={tab === t.id ? "btn-primary !py-1.5" : "btn-quiet !py-1.5"}
          >
            {t.label}
          </button>
        ))}
      </nav>
      <div className="mt-6">
        {tab === "activity" && <ActivityPanel />}
        {tab === "payout" && <Payouts />}
        {tab === "curators" && <Curators />}
        {tab === "settings" && <Settings />}
        {tab === "support" && <Support />}
        {tab === "biz" && <BizReview />}
        {tab === "topups" && (
          <div className="grid gap-8">
            <BizRefunds />
            <Topups />
          </div>
        )}
        {tab === "requests" && <PayoutRequests />}
        {tab === "disputes" && <Disputes />}
        {tab === "quality" && <StoreQuality />}
        {tab === "blocks" && <Blocks />}
        {tab === "usage" && <UsagePanel />}
        {tab === "errors" && <ErrorsPanel />}
      </div>
    </div>
  );
}

// ── 정산 ─────────────────────────
type Month = { month: string; revenue: number; currency: string; note: string | null; finalized_at: string | null };
type Preview = { user_id: string; handle: string; display_name: string; views: number; amount: number; detail: { list: string; views: number; role: string; amount: number }[] };
type Payout = { id: string; handle: string; views: number; amount: number; currency: string; status: "pending" | "paid" | "held"; method: string | null; reference: string | null; paid_at: string | null; detail: Preview["detail"] };

function months() {
  const out: string[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = 0; i < 13; i++) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`);
    d.setMonth(d.getMonth() - 1);
  }
  return out;
}

function Payouts() {
  const supabase = useMemo(() => createClient(), []);
  const options = useMemo(() => months(), []);
  const [month, setMonth] = useState(options[1]);
  const [row, setRow] = useState<Month | null>(null);
  const [revenue, setRevenue] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState<Preview[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setMsg("");
    const [{ data: m }, { data: s }] = await Promise.all([
      supabase.from("ad_revenue_months").select("*").eq("month", month).maybeSingle(),
      supabase.from("monetization_settings").select("currency").maybeSingle(),
    ]);
    const r = m as Month | null;
    setRow(r);
    setRevenue(r ? String(r.revenue) : "");
    setCurrency(r?.currency ?? (s?.currency as string) ?? "USD");
    setNote(r?.note ?? "");
    if (r?.finalized_at) {
      const { data } = await supabase.from("payouts").select("*").eq("month", month).order("amount", { ascending: false });
      setPayouts((data as Payout[]) ?? []);
      setPreview([]);
    } else {
      const { data } = await supabase.rpc("admin_payout_preview", { p_month: month });
      setPreview((data as Preview[]) ?? []);
      setPayouts([]);
    }
  }, [supabase, month]);

  useEffect(() => {
    // 달을 바꾸면 그 달 자료를 다시 읽는다
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function saveRevenue() {
    const v = Number(revenue);
    if (!Number.isFinite(v) || v < 0) return setMsg("금액을 숫자로 넣으세요.");
    const { error } = await supabase
      .from("ad_revenue_months")
      .upsert({ month, revenue: v, currency: currency.toUpperCase().slice(0, 3), note: note || null });
    if (error) return setMsg("저장하지 못했습니다.");
    setMsg("저장했습니다. 아래 미리보기가 새 금액으로 바뀌었어요.");
    load();
  }

  async function finalize() {
    const { data, error } = await supabase.rpc("admin_finalize_month", { p_month: month });
    if (error) return setMsg("확정하지 못했습니다. 수익 금액을 먼저 저장했는지 확인하세요.");
    setMsg(`확정했습니다. 지급 ${data}건.`);
    load();
  }

  function downloadCsv() {
    const head = ["handle", "amount", "currency", "status", "method", "reference", "paid_at", "views"];
    const lines = payouts.map((p) => [p.handle, p.amount, p.currency, p.status, p.method ?? "", p.reference ?? "", p.paid_at ?? "", p.views]);
    const csv = [head, ...lines].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `pinwith-payouts-${month.slice(0, 7)}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  }

  const finalized = !!row?.finalized_at;
  const list = finalized ? payouts : preview;
  const total = list.reduce((s, p) => s + Number(p.amount), 0);

  return (
    <section className="grid gap-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-[13px] font-semibold">
          달
          <select value={month} onChange={(e) => setMonth(e.target.value)} className="field">
            {options.map((m) => (
              <option key={m} value={m}>{m.slice(0, 7)}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-[13px] font-semibold">
          리스트 화면 광고 수익
          <input value={revenue} onChange={(e) => setRevenue(e.target.value)} inputMode="decimal" disabled={finalized} className="field w-40" placeholder="예: 1250.40" />
        </label>
        <label className="grid gap-1 text-[13px] font-semibold">
          통화
          <input value={currency} onChange={(e) => setCurrency(e.target.value)} maxLength={3} disabled={finalized} className="field w-20" />
        </label>
        <label className="grid min-w-[200px] flex-1 gap-1 text-[13px] font-semibold">
          메모
          <input value={note} onChange={(e) => setNote(e.target.value)} disabled={finalized} className="field" placeholder="애드센스 확정 금액, 환율 등" />
        </label>
        {!finalized && <button type="button" onClick={saveRevenue} className="btn-quiet">저장</button>}
        {!finalized && row && (
          <ConfirmButton
            label="정산 확정"
            question={`${month.slice(0, 7)} 정산을 확정할까요? 확정하면 금액이 지급 목록으로 굳어지고 바꿀 수 없어요.`}
            confirmLabel="확정"
            onConfirm={finalize}
            className="btn-primary"
          />
        )}
      </div>
      <p className="text-[13px] text-muted">
        계산: (그 달 리스트 화면 광고 수익) × (수익화한 리스트의 실제 광고 노출 ÷ 모든 리스트의 실제 광고 노출) × 큐레이터 분배율. 공동 편집자 배분(%)은 그
        리스트 몫에서 떼어 주고 나머지가 주인 몫이에요. 자체 홍보 노출과 주인·편집자 본인 열람은 빠져요. 애드센스에서 리스트 화면(URL 채널) 수익을 확정한 뒤
        넣으세요.
      </p>
      {msg && <p role="status" className="text-[14px] text-teal">{msg}</p>}
      <p className="text-[13px] text-muted">확정한 금액은 각 큐레이터의 ‘받을 수 있는 금액’에 더해지고, 실제 지급은 ‘지급 요청’ 탭에서 처리해요.</p>

      <div className="flex items-center gap-3">
        <h2 className="text-[17px] font-semibold">{finalized ? "지급 목록(확정됨)" : "미리보기"}</h2>
        <span className="text-[13px] text-muted">
          {list.length}명 · 합계 {num(total)} {currency}
          {row && ` / 수익 ${num(row.revenue)} ${row.currency}`}
        </span>
        {finalized && payouts.length > 0 && (
          <button type="button" onClick={downloadCsv} className="btn-quiet ml-auto !py-1.5">CSV 내려받기</button>
        )}
      </div>
      {list.length === 0 ? (
        <p className="text-[14px] text-muted">이 달에 나눌 대상이 없어요(수익화한 리스트의 실제 광고 노출이 없거나 수익 금액을 넣지 않았어요).</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[14px]">
            <thead className="border-b border-rule text-[12px] text-muted">
              <tr>
                <th className="py-2">큐레이터</th>
                <th>노출</th>
                <th>금액</th>
                <th>리스트별</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={"id" in p ? p.id : p.user_id} className="border-b border-rule align-top">
                  <td className="py-2">
                    <Link href={`/@${p.handle}`} className="font-semibold">@{p.handle}</Link>
                  </td>
                  <td>{num(p.views)}</td>
                  <td className="font-semibold">{num(p.amount)}</td>
                  <td className="text-[12px] text-ink/75">
                    {p.detail.map((d, i) => (
                      <span key={i} className="block">
                        {d.list} · {d.role === "editor" ? "공동 편집" : "주인"} · {num(d.views)}회 · {num(d.amount)}
                      </span>
                    ))}
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

// ── 큐레이터·분배율 ─────────────────────────
type Curator = { user_id: string; handle: string; display_name: string; followers: number; views_30d: number; eligible: boolean; monetized_lists: number; rate_pct: number | null };

function Curators() {
  const supabase = useMemo(() => createClient(), []);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Curator[]>([]);
  const [def, setDef] = useState(50);
  const [msg, setMsg] = useState("");

  const load = useCallback(async (query: string) => {
    const [{ data }, { data: s }] = await Promise.all([
      supabase.rpc("admin_curators", { p_query: query || null }),
      supabase.from("monetization_settings").select("default_rate_pct").maybeSingle(),
    ]);
    setRows((data as Curator[]) ?? []);
    if (s) setDef(Number(s.default_rate_pct));
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load("");
  }, [load]);

  async function setRate(c: Curator, value: string) {
    const v = value.trim();
    const { error } = v === ""
      ? await supabase.from("curator_rates").delete().eq("user_id", c.user_id)
      : await supabase.from("curator_rates").upsert({ user_id: c.user_id, rate_pct: Number(v), updated_at: new Date().toISOString() });
    if (error) return setMsg("저장하지 못했습니다(0~100 사이 숫자).");
    setMsg(v === "" ? `@${c.handle}: 기본 분배율(${def}%)로 되돌렸어요.` : `@${c.handle}: 분배율 ${v}%. 기준과 관계없이 수익화할 수 있어요.`);
    load(q);
  }

  return (
    <section className="grid gap-4">
      <form onSubmit={(e) => { e.preventDefault(); load(q); }} className="flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} className="field flex-1" placeholder="아이디나 이름으로 찾기" />
        <button className="btn-quiet">찾기</button>
      </form>
      <p className="text-[13px] text-muted">
        분배율 칸을 비우면 기본 분배율({def}%)을 따라요. 분배율을 따로 정하면 그 큐레이터는 팔로워·노출 기준과 관계없이 수익화를 켤 수 있어요(직접 영입한
        인플루언서 등).
      </p>
      {msg && <p role="status" className="text-[14px] text-teal">{msg}</p>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-[14px]">
          <thead className="border-b border-rule text-[12px] text-muted">
            <tr>
              <th className="py-2">큐레이터</th>
              <th>팔로워</th>
              <th>최근 30일 노출</th>
              <th>자격</th>
              <th>수익화 리스트</th>
              <th>분배율 %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.user_id} className="border-b border-rule">
                <td className="py-2">
                  <Link href={`/@${c.handle}`} className="font-semibold">@{c.handle}</Link>
                  <span className="block text-[12px] text-muted">{c.display_name}</span>
                </td>
                <td>{num(c.followers)}</td>
                <td>{num(c.views_30d)}</td>
                <td>{c.eligible ? "✓" : "–"}</td>
                <td>{c.monetized_lists}</td>
                <td>
                  <input
                    key={`${c.user_id}-${c.rate_pct}`}
                    defaultValue={c.rate_pct ?? ""}
                    placeholder={`${def}`}
                    inputMode="decimal"
                    onBlur={(e) => e.target.value !== String(c.rate_pct ?? "") && setRate(c, e.target.value)}
                    className="field w-20 !py-1"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ── 수익화 기준 ─────────────────────────
function Settings() {
  const supabase = useMemo(() => createClient(), []);
  const [s, setS] = useState<{ min_followers: number; min_ad_views_30d: number; default_rate_pct: number; currency: string; platform_fee_pct: number; min_payout: number; est_rpm: number } | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    supabase.from("monetization_settings").select("min_followers, min_ad_views_30d, default_rate_pct, currency, platform_fee_pct, min_payout, est_rpm").maybeSingle().then(({ data }) => data && setS(data as NonNullable<typeof s>));
  }, [supabase]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!s) return;
    const { error } = await supabase
      .from("monetization_settings")
      .update({ ...s, currency: s.currency.toUpperCase(), updated_at: new Date().toISOString() })
      .eq("id", true);
    setMsg(error ? "저장하지 못했습니다." : "저장했습니다. 바로 적용돼요.");
  }

  if (!s) return <p className="text-muted">불러오는 중…</p>;
  const field = (k: keyof typeof s, label: string, hint: string) => (
    <label className="grid gap-1 text-[13px] font-semibold">
      {label}
      <input
        value={s[k]}
        onChange={(e) => setS({ ...s, [k]: k === "currency" ? e.target.value : Number(e.target.value) })}
        inputMode={k === "currency" ? "text" : "decimal"}
        className="field w-48"
      />
      <span className="font-normal text-muted">{hint}</span>
    </label>
  );
  return (
    <form onSubmit={save} className="grid max-w-[520px] gap-4">
      <p className="text-[14px] text-ink/80">아래 둘 중 하나라도 넘으면 수익화를 켤 수 있고, 알림 맨 위에 안내가 고정돼요(수익화한 리스트가 생기면 사라짐).</p>
      {field("min_followers", "팔로워 수 기준", "이 수 이상이면 자격")}
      {field("min_ad_views_30d", "최근 30일 광고 노출 기준", "리스트 화면 광고 자리가 절반 이상 1초 넘게 보인 횟수(같은 사람 30분 안 반복·본인 열람 제외)")}
      {field("default_rate_pct", "기본 분배율 %", "큐레이터별로 따로 정하지 않았을 때")}
      {field("currency", "기본 통화", "예: USD, SGD, KRW. 광고 정산·가게 광고비·지급 모두 이 통화")}
      {field("est_rpm", "예상 광고 단가(1,000회 노출당)", "큐레이터 콘솔의 '이번 달 예상'에 씀. 지난달 실제 값으로 맞춰 주세요")}
      {field("platform_fee_pct", "가게 제휴 수수료 %", "가게가 내는 금액 중 PinWith 몫. 나머지는 큐레이터")}
      {field("min_payout", "최소 지급 요청 금액", "이보다 적으면 지급 요청 버튼이 꺼져요")}
      {msg && <p role="status" className="text-[14px] text-teal">{msg}</p>}
      <button className="btn-primary justify-self-start">저장</button>
    </form>
  );
}

// ── 문의·신고 ─────────────────────────
type Req = {
  id: string; category: string; email: string | null; body: string; page_url: string | null; created_at: string; handled_at: string | null;
  user: { handle: string } | null;
  list: { title: string; slug: string; owner: { handle: string } | null } | null;
};
const CAT: Record<string, string> = { question: "이용 문의", bug: "오류·불편", report: "신고", partnership: "제휴·광고", other: "기타" };

function Support() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<Req[]>([]);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    let q = supabase
      .from("support_requests")
      .select("id, category, email, body, page_url, created_at, handled_at, user:profiles!support_requests_user_id_fkey(handle), list:lists(title, slug, owner:profiles!lists_owner_id_fkey(handle))")
      .order("created_at", { ascending: false })
      .limit(200);
    if (open) q = q.is("handled_at", null);
    const { data } = await q;
    setRows((data as unknown as Req[]) ?? []);
  }, [supabase, open]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function toggle(r: Req) {
    await supabase.from("support_requests").update({ handled_at: r.handled_at ? null : new Date().toISOString() }).eq("id", r.id);
    load();
  }

  return (
    <section className="grid gap-3">
      <label className="flex items-center gap-2 text-[14px]">
        <input type="checkbox" checked={open} onChange={(e) => setOpen(e.target.checked)} /> 처리 안 한 것만
      </label>
      {rows.length === 0 && <p className="text-[14px] text-muted">없어요.</p>}
      <ul className="divide-y divide-rule">
        {rows.map((r) => (
          <li key={r.id} className="py-3 text-[14px]">
            <p className="text-[12px] text-muted">
              {new Date(r.created_at).toLocaleString("ko-KR")} · <b className="text-ink">{CAT[r.category] ?? r.category}</b>
              {r.user ? ` · @${r.user.handle}` : " · 로그인 안 함"}
              {r.email && ` · ${r.email}`}
            </p>
            {r.list && (
              <p className="mt-1">
                대상 리스트:{" "}
                {r.list.owner ? (
                  <Link href={`/@${r.list.owner.handle}/${r.list.slug}`} className="font-semibold text-teal">{r.list.title}</Link>
                ) : (
                  r.list.title
                )}
              </p>
            )}
            <p className="mt-1 whitespace-pre-wrap text-ink">{r.body}</p>
            <p className="mt-1 flex items-center gap-3 text-[12px] text-muted">
              {r.page_url && <span className="truncate">화면: {r.page_url}</span>}
              <button type="button" onClick={() => toggle(r)} className="ml-auto btn-quiet !px-2.5 !py-1 !text-[12px]">
                {r.handled_at ? "처리 안 함으로" : "처리함"}
              </button>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
