"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ConfirmButton, money } from "./console/ui";

// ── 가게 인증: 신청 확인 → 승인·반려·정지 ─────────────────────────
type Biz = {
  id: string; place_id: string; place_name: string; place_address: string | null; business_name: string; reg_number: string | null;
  contact_name: string; contact_phone: string; role: string; doc_path: string | null; status: string; review_note: string | null;
  created_at: string; owner: { handle: string } | null;
};
const BS: Record<string, string> = { pending: "확인 대기", approved: "승인", rejected: "반려", suspended: "정지" };

export function BizReview() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<Biz[]>([]);
  const [onlyPending, setOnlyPending] = useState(true);
  const [msg, setMsg] = useState("");
  const load = useCallback(async () => {
    let q = supabase.from("businesses").select("*, owner:profiles!businesses_owner_id_fkey(handle)").order("created_at", { ascending: false }).limit(200);
    if (onlyPending) q = q.eq("status", "pending");
    const { data } = await q;
    setRows((data as unknown as Biz[]) ?? []);
  }, [supabase, onlyPending]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function openDoc(path: string) {
    const { data } = await supabase.storage.from("biz-docs").createSignedUrl(path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
  }

  async function decide(b: Biz, status: string, reason?: string) {
    const note = status === "approved" ? null : reason?.trim() || null;
    const { error } = await supabase.from("businesses").update({ status, review_note: note }).eq("id", b.id);
    setMsg(error ? (error.code === "23505" ? "이 가게는 이미 다른 계정이 인증돼 있어요." : "바꾸지 못했어요.") : `${b.place_name}: ${BS[status]}`);
    load();
  }

  return (
    <section className="grid gap-3">
      <p className="text-[13px] text-muted">
        확인 방법: ① 증빙 자료(사업자등록증)의 상호·번호가 신청 내용과 같은지 ② 구글 지도에 나온 가게 전화번호로 전화해 신청자(담당자)가 맞는지 ③ 한국 사업자는
        국세청 사업자 상태(휴·폐업 여부)를 확인. 한 가게에는 한 계정만 승인돼요.
      </p>
      <label className="flex items-center gap-2 text-[14px]">
        <input type="checkbox" checked={onlyPending} onChange={(e) => setOnlyPending(e.target.checked)} /> 확인 대기만
      </label>
      {msg && <p role="status" className="text-[14px] text-teal">{msg}</p>}
      {rows.length === 0 && <p className="text-[14px] text-muted">없어요.</p>}
      <ul className="divide-y divide-rule">
        {rows.map((b) => (
          <li key={b.id} className="grid gap-1 py-3 text-[14px]">
            <p>
              <b>{b.place_name}</b> · {b.business_name} <span className="text-[12px] text-muted">({BS[b.status]})</span>
            </p>
            <p className="text-[12px] text-muted">{b.place_address}</p>
            <p className="text-[13px]">
              신청: {b.owner ? `@${b.owner.handle}` : "-"} · {b.role === "owner" ? "주인" : "관리자"} · {b.contact_name} · {b.contact_phone}
              {b.reg_number && ` · 사업자번호 ${b.reg_number}`}
            </p>
            <p className="flex flex-wrap items-center gap-2 text-[13px]">
              <a href={`https://www.google.com/maps/place/?q=place_id:${b.place_id}`} target="_blank" rel="noopener noreferrer" className="text-teal underline">
                구글 지도에서 가게 보기(전화번호 확인)
              </a>
              {b.doc_path && <button type="button" onClick={() => openDoc(b.doc_path!)} className="text-teal underline">증빙 자료 보기</button>}
              {b.review_note && <span className="text-muted">메모: {b.review_note}</span>}
            </p>
            <p className="flex gap-2">
              {b.status !== "approved" && <button type="button" onClick={() => decide(b, "approved")} className="btn-primary !px-3 !py-1 !text-[13px]">승인</button>}
              {b.status === "pending" && (
                <ConfirmButton label="반려" question="이 신청을 반려할까요? 사유가 가게에 보여요." withNote="반려 사유(가게에 보여요)" noteDefault={b.review_note ?? ""} noteRequired
                  confirmLabel="반려" onConfirm={(note) => decide(b, "rejected", note)} className="btn-quiet !px-3 !py-1 !text-[13px]" />
              )}
              {b.status === "approved" && (
                <ConfirmButton label="정지" question="이 가게를 정지할까요? 과금·예약·콘솔 사용이 멈추고 가게에 알림이 가요." withNote="정지 사유(가게에 보여요)" noteDefault={b.review_note ?? ""} noteRequired
                  confirmLabel="정지" onConfirm={(note) => decide(b, "suspended", note)} className="btn-quiet !px-3 !py-1 !text-[13px]" />
              )}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── 광고비 충전: 입금 확인 ─────────────────────────
type Topup = { id: string; amount: number; currency: string; method: string; provider: string; pay_amount: number | null; pay_currency: string | null; status: string; reference: string | null; created_at: string; biz: { place_name: string; business_name: string; contact_phone: string } | null };

export function Topups() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<Topup[]>([]);
  const load = useCallback(async () => {
    const { data } = await supabase
      .from("biz_topups")
      .select("*, biz:businesses(place_name, business_name, contact_phone)")
      .order("created_at", { ascending: false })
      .limit(200);
    setRows((data as unknown as Topup[]) ?? []);
  }, [supabase]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function mark(t: Topup, status: "paid" | "cancelled", memo?: string) {
    const reference = status === "paid" ? memo?.trim() || null : null;
    await supabase.from("biz_topups").update({ status, reference, paid_at: status === "paid" ? new Date().toISOString() : null }).eq("id", t.id);
    load();
  }

  return (
    <section className="grid gap-3">
      <p className="text-[13px] text-muted">
        계좌 입금 요청은 입금 방법을 안내하고, 입금이 확인되면 ‘입금 확인’을 누르세요. 카드 결제(Stripe)는 결제가 끝나면 자동으로 잔액에 들어가요(미완료 건은 취소해도 돼요).
      </p>
      {rows.length === 0 && <p className="text-[14px] text-muted">없어요.</p>}
      <ul className="divide-y divide-rule text-[14px]">
        {rows.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center gap-2 py-2">
            <span className="tabular-nums text-muted">{new Date(t.created_at).toLocaleDateString("ko-KR")}</span>
            <b>{t.biz?.place_name}</b>
            <span className="text-[12px] text-muted">{t.biz?.business_name} · {t.biz?.contact_phone}</span>
            <b className="tabular-nums">{money(t.amount, t.currency)}</b>
            <span className="text-[12px] text-muted">
              {t.provider === "bank" ? "계좌 입금" : "Stripe 카드"}
              {t.pay_currency && t.pay_currency !== t.currency && t.pay_amount ? ` · ${money(t.pay_amount, t.pay_currency)}` : ""}
            </span>
            <span className={t.status === "paid" ? "text-teal" : t.status === "cancelled" ? "text-muted" : "text-pin"}>
              {t.status === "paid" ? `입금 확인${t.reference ? ` (${t.reference})` : ""}` : t.status === "cancelled" ? "취소" : "입금 대기"}
            </span>
            {t.status === "requested" && (
              <span className="ml-auto flex gap-2">
                {t.provider === "bank" && (
                  <ConfirmButton label="입금 확인" question="입금을 확인했나요? 확인하면 가게 광고비 잔액에 바로 들어가요." withNote="입금 확인 메모(입금자명·거래 번호)" noteDefault={t.reference ?? ""}
                    confirmLabel="입금 확인" onConfirm={(note) => mark(t, "paid", note)} className="btn-primary !px-3 !py-1 !text-[13px]" />
                )}
                <ConfirmButton label="취소" question="이 충전 요청을 취소할까요?" confirmLabel="충전 취소" onConfirm={() => mark(t, "cancelled")} className="btn-quiet !px-3 !py-1 !text-[13px]" />
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── 지급 요청: 지급 정보 보고 송금 후 '지급함' ─────────────────────────
type Req = { id: string; user_id: string; amount: number; currency: string; status: string; reference: string | null; note: string | null; created_at: string; user: { handle: string } | null };
type Prof = { user_id: string; method: string; holder_name: string; email: string | null; bank_name: string | null; account_number: string | null; swift: string | null; country: string | null; currency: string | null };

export function PayoutRequests() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<Req[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Prof>>({});
  const [open, setOpen] = useState(true);
  const load = useCallback(async () => {
    let q = supabase.from("payout_requests").select("*, user:profiles!payout_requests_user_id_fkey(handle)").order("created_at", { ascending: false }).limit(200);
    if (open) q = q.eq("status", "requested");
    const { data } = await q;
    const reqs = (data as unknown as Req[]) ?? [];
    setRows(reqs);
    const ids = [...new Set(reqs.map((r) => r.user_id).filter(Boolean))];
    if (ids.length) {
      const { data: ps } = await supabase.from("payout_profiles").select("*").in("user_id", ids);
      setProfiles(Object.fromEntries(((ps as Prof[]) ?? []).map((p) => [p.user_id, p])));
    }
  }, [supabase, open]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function decide(r: Req, status: "paid" | "rejected", note: string) {
    const text = note.trim();
    await supabase
      .from("payout_requests")
      .update(status === "paid" ? { status, reference: text, paid_at: new Date().toISOString() } : { status, note: text })
      .eq("id", r.id);
    load();
  }

  return (
    <section className="grid gap-3">
      <p className="text-[13px] text-muted">
        큐레이터가 요청한 금액이에요. 아래 지급 정보로 송금한 뒤 ‘지급함’을 누르세요. 반려하면 그 금액은 다시 큐레이터의 받을 수 있는 금액으로 돌아가요.
      </p>
      <label className="flex items-center gap-2 text-[14px]">
        <input type="checkbox" checked={open} onChange={(e) => setOpen(e.target.checked)} /> 처리 중인 것만
      </label>
      {rows.length === 0 && <p className="text-[14px] text-muted">없어요.</p>}
      <ul className="divide-y divide-rule text-[14px]">
        {rows.map((r) => {
          const p = profiles[r.user_id];
          return (
            <li key={r.id} className="grid gap-1 py-3">
              <p className="flex flex-wrap items-center gap-2">
                <span className="tabular-nums text-muted">{new Date(r.created_at).toLocaleDateString("ko-KR")}</span>
                {r.user && <Link href={`/@${r.user.handle}`} className="font-semibold">@{r.user.handle}</Link>}
                <b className="tabular-nums">{money(r.amount, r.currency)}</b>
                <span className={r.status === "paid" ? "text-teal" : r.status === "rejected" ? "text-pin" : "text-muted"}>
                  {r.status === "paid" ? `지급함 (${r.reference ?? ""})` : r.status === "rejected" ? `반려 (${r.note ?? ""})` : "처리 중"}
                </span>
              </p>
              {p ? (
                <p className="text-[13px] text-ink/80">
                  {p.method === "bank" ? "은행" : p.method === "wise" ? "Wise" : "PayPal"} · {p.holder_name}
                  {p.email && ` · ${p.email}`}
                  {p.bank_name && ` · ${p.bank_name}`}
                  {p.account_number && ` ${p.account_number}`}
                  {p.swift && ` · SWIFT ${p.swift}`}
                  {p.country && ` · ${p.country}`}
                  {p.currency && ` · ${p.currency}로 받기`}
                </p>
              ) : (
                <p className="text-[13px] text-pin">지급 정보 없음</p>
              )}
              {r.status === "requested" && (
                <p className="flex gap-2">
                  <ConfirmButton label="지급함" question="송금을 마쳤나요? 큐레이터에게 지급 완료 알림이 가요." withNote="송금 거래 번호(Wise·PayPal·은행)" noteRequired
                    confirmLabel="지급 완료" onConfirm={(note) => decide(r, "paid", note)} className="btn-primary !px-3 !py-1 !text-[13px]" />
                  <ConfirmButton label="반려" question="이 지급 요청을 반려할까요? 금액은 큐레이터의 받을 수 있는 금액으로 돌아가요." withNote="반려 사유(큐레이터에게 보여요)" noteRequired
                    confirmLabel="반려" onConfirm={(note) => decide(r, "rejected", note)} className="btn-quiet !px-3 !py-1 !text-[13px]" />
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ── 예약 품질: 노쇼·가게 취소 비율이 주변보다 높은 가게, 조치 ─────────────────────────
type Quality = {
  business_id: string; place_name: string; business: string; status: string; owner: string; reservations_enabled: boolean; admin_note: string | null;
  confirmed: number; bad: number; no_show: number; cancel_business: number; rate: number | null; peer: number; flagged: boolean; alerts: number;
  reservation_offer_active: boolean; curators: number; open_disputes: number;
  lock_reservation_offer: boolean; lock_reservations: boolean;
};

export function StoreQuality() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<Quality[] | null>(null);
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const [msg, setMsg] = useState("");
  const load = useCallback(async () => {
    const { data } = await supabase.rpc("admin_store_quality");
    setRows((data as Quality[]) ?? []);
  }, [supabase]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function run(label: string, p: PromiseLike<{ error: unknown }>) {
    const { error } = await p;
    setMsg(error ? `${label}: 실패했어요.` : `${label}: 처리했어요.`);
    load();
  }

  if (!rows) return <p className="text-muted">불러오는 중…</p>;
  const pct = (v: number | null) => (v == null ? "–" : `${Math.round(v * 100)}%`);
  const shown = onlyFlagged ? rows.filter((r) => r.flagged) : rows;
  return (
    <section className="grid gap-3">
      <p className="text-[13px] text-muted">
        최근 90일 확정 예약 중 노쇼·가게 취소 비율이에요. 확정 5건 이상이면서 반경 3km 평균의 2배 또는 평균 +20%p를 넘으면 ‘이상’으로 표시하고, 연결된 큐레이터에게는 이미 알림이
        가요. 필요하면 예약 제휴를 끄거나(큐레이터 보상 중단), 예약 기능을 끄거나, 가게를 정지하세요. 제휴·예약 기능을 끄면 잠기기 때문에 여기서 풀어 주기 전까지 가게가 다시 켤 수 없고(이의 제기는 가능), 가게와 예약 제휴로 연결된 큐레이터에게도 알림이 가요. 정지하면 가게에 알림이 가요.
      </p>
      <label className="flex items-center gap-2 text-[14px]">
        <input type="checkbox" checked={onlyFlagged} onChange={(e) => setOnlyFlagged(e.target.checked)} /> 이상 표시된 가게만
      </label>
      {msg && <p role="status" className="text-[14px] text-teal">{msg}</p>}
      {shown.length === 0 && <p className="text-[14px] text-muted">없어요.</p>}
      <ul className="grid gap-3 lg:grid-cols-2">
        {shown.map((r) => (
          <li key={r.business_id} className={`rounded-xl border p-4 text-[14px] ${r.flagged ? "border-pin" : "border-rule"}`}>
            <p className="flex flex-wrap items-center gap-2">
              <b className="text-[16px]">{r.place_name}</b>
              <span className="text-[12px] text-muted">@{r.owner}</span>
              {r.flagged && <span className="rounded-full bg-pin px-2 py-0.5 text-[11px] text-white">이상</span>}
              {r.status === "suspended" && <span className="rounded-full bg-ink px-2 py-0.5 text-[11px] text-white">정지됨</span>}
              {r.open_disputes > 0 && <span className="rounded-full bg-surface px-2 py-0.5 text-[11px]">이의 제기 {r.open_disputes}</span>}
            </p>
            <p className="mt-1">
              노쇼·가게 취소 <b className={r.flagged ? "text-pin" : ""}>{pct(r.rate)}</b>
              <span className="text-muted"> ({r.bad}/{r.confirmed}건 · 노쇼 {r.no_show} · 가게 취소 {r.cancel_business}) · 주변 평균 {pct(r.peer)}</span>
            </p>
            <p className="text-[12px] text-muted">
              큐레이터 알림 {r.alerts}번 · 연결 큐레이터 {r.curators}명 · 예약 기능 {r.lock_reservations ? "🔒 운영자 잠금" : r.reservations_enabled ? "켬" : "끔"} · 예약 제휴{" "}
              {r.lock_reservation_offer ? "🔒 운영자 잠금" : r.reservation_offer_active ? "켬" : "끔"}
            </p>
            <label className="mt-2 grid gap-1 text-[12px] font-semibold">
              운영 메모
              <input
                defaultValue={r.admin_note ?? ""}
                onBlur={(e) => e.target.value !== (r.admin_note ?? "") && run("메모", supabase.from("businesses").update({ admin_note: e.target.value || null }).eq("id", r.business_id))}
                className="field !py-1 !text-[13px]"
                placeholder="예: 10/20 사장님과 통화, 노쇼 기록 기준 안내함"
              />
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              {r.lock_reservation_offer ? (
                <ConfirmButton label="예약 제휴 잠금 풀기" question="잠금을 풀까요? 가게가 다시 ‘예약 확정’ 모델을 켤 수 있어요(자동으로 켜지지는 않아요)." confirmLabel="풀기"
                  onConfirm={() => run("예약 제휴 잠금 풀기", supabase.rpc("admin_set_lock", { p_business: r.business_id, p_what: "offer", p_on: false, p_note: null }))} />
              ) : (
                <ConfirmButton label="예약 제휴 끄기" question="‘예약 확정’ 과금 모델을 끄고 잠글까요? 큐레이터 보상이 멈추고, 풀어 주기 전까지 가게가 다시 켤 수 없어요. 가게와 연결된 큐레이터에게 알림이 가요."
                  withNote="사유(가게·큐레이터에게 보여요)" confirmLabel="끄고 잠그기"
                  onConfirm={(note) => run("예약 제휴 끄기", supabase.rpc("admin_set_lock", { p_business: r.business_id, p_what: "offer", p_on: true, p_note: note || null }))} />
              )}
              {r.lock_reservations ? (
                <ConfirmButton label="예약 기능 잠금 풀기" question="잠금을 풀까요? 가게가 다시 예약 문의를 켤 수 있어요(자동으로 켜지지는 않아요)." confirmLabel="풀기"
                  onConfirm={() => run("예약 기능 잠금 풀기", supabase.rpc("admin_set_lock", { p_business: r.business_id, p_what: "reservations", p_on: false, p_note: null }))} />
              ) : (
                <ConfirmButton label="예약 기능 끄기" question="예약 문의를 끄고 잠글까요? 풀어 주기 전까지 가게가 다시 켤 수 없어요. 가게와 예약 제휴로 연결된 큐레이터에게 알림이 가요."
                  withNote="사유(가게·큐레이터에게 보여요)" confirmLabel="끄고 잠그기"
                  onConfirm={(note) => run("예약 기능 끄기", supabase.rpc("admin_set_lock", { p_business: r.business_id, p_what: "reservations", p_on: true, p_note: note || null }))} />
              )}
              {r.status === "approved" ? (
                <ConfirmButton label="가게 정지" question="가게 계정을 정지할까요? 과금·예약·콘솔 사용이 멈추고 가게에 알림이 가요." withNote="정지 사유(가게에 보여요)" confirmLabel="정지"
                  onConfirm={(note) => run("정지", supabase.from("businesses").update({ status: "suspended", review_note: note || "운영 정책 위반 확인" }).eq("id", r.business_id))} />
              ) : (
                <ConfirmButton label="정지 풀기" question="정지를 풀까요?" confirmLabel="풀기"
                  onConfirm={() => run("정지 풀기", supabase.from("businesses").update({ status: "approved" }).eq("id", r.business_id))} />
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── 차단 현황: 가게가 큐레이터를 차단한 기록(남용 확인, 풀기) ─────────────────────────
type Block = { business_id: string; place_name: string; curator_id: string; handle: string; name: string; active: boolean; at: string; blocks_by_this_business: number; blocked_curator_total: number };

export function Blocks() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<Block[] | null>(null);
  const [msg, setMsg] = useState("");
  const load = useCallback(async () => {
    const { data } = await supabase.rpc("admin_blocks");
    setRows((data as Block[]) ?? []);
  }, [supabase]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);
  if (!rows) return <p className="text-muted">불러오는 중…</p>;
  return (
    <section className="grid gap-3">
      <p className="text-[13px] text-muted">
        가게가 큐레이터를 차단한 기록이에요. 한 가게가 여러 큐레이터를 차단하거나(나쁜 리뷰 막기 의심), 한 큐레이터가 여러 가게에서 차단되면(문제 큐레이터 의심) 확인해 보세요.
      </p>
      {msg && <p role="status" className="text-[14px] text-teal">{msg}</p>}
      {rows.length === 0 && <p className="text-[14px] text-muted">없어요.</p>}
      <ul className="divide-y divide-rule text-[14px]">
        {rows.map((k) => (
          <li key={`${k.business_id}-${k.curator_id}`} className="flex flex-wrap items-center gap-2 py-2">
            <b>{k.place_name}</b> → <Link href={`/@${k.handle}`} className="text-teal">@{k.handle}</Link>
            <span className="text-[12px] text-muted">
              {new Date(k.at).toLocaleDateString("ko-KR")} · {k.active ? "차단 중" : "풀림"} · 이 가게의 차단 {k.blocks_by_this_business}건 · 이 큐레이터가 받은 차단 {k.blocked_curator_total}건
            </span>
            {(k.blocks_by_this_business >= 3 || k.blocked_curator_total >= 3) && <span className="rounded-full bg-pin px-2 py-0.5 text-[11px] text-white">확인 필요</span>}
            {k.active && (
              <span className="ml-auto">
                <ConfirmButton label="운영자가 풀기" question="이 차단을 풀까요? 큐레이터 리스트에 가게가 다시 보이고 다시 담을 수 있어요." confirmLabel="풀기"
                  onConfirm={async () => {
                    const { error } = await supabase.from("biz_blocks").update({ active: false }).eq("business_id", k.business_id).eq("curator_id", k.curator_id);
                    setMsg(error ? "풀지 못했어요." : `${k.place_name} → @${k.handle} 차단을 풀었어요.`);
                    load();
                  }} />
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── 이의 제기(분쟁) 처리 ─────────────────────────
type Dispute = {
  id: string; filer_role: "curator" | "business"; filer: string | null; place_name: string; curator: string | null; reason: string;
  status: string; resolution: string | null; adjustment: number | null; created_at: string; resolved_at: string | null;
  charge: { model: string; amount: number; at: string } | null;
  reservation: { status: string; visit_date: string; visit_time: string | null; party_size: number; cancelled_by: string | null; reply: string | null } | null;
  store_rate: number | null; peer_rate: number;
};

export function Disputes() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<Dispute[] | null>(null);
  const [open, setOpen] = useState(true);
  const [form, setForm] = useState<Record<string, { action: string; amount: string; note: string }>>({});
  const [msg, setMsg] = useState("");
  const load = useCallback(async () => {
    const { data } = await supabase.rpc("admin_disputes", { p_open_only: open });
    setRows((data as Dispute[]) ?? []);
  }, [supabase, open]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function resolve(d: Dispute) {
    const f = form[d.id] ?? { action: "reject", amount: "", note: "" };
    const { error } = await supabase.rpc("admin_resolve_dispute", { p_id: d.id, p_action: f.action, p_amount: Number(f.amount) || 0, p_note: f.note });
    setMsg(error ? (error.message.includes("amount") ? "금액을 넣으세요." : "처리하지 못했어요.") : "처리했어요. 양쪽에 알림이 갔어요.");
    load();
  }

  if (!rows) return <p className="text-muted">불러오는 중…</p>;
  const pct = (v: number | null) => (v == null ? "–" : `${Math.round(v * 100)}%`);
  return (
    <section className="grid gap-3">
      <p className="text-[13px] text-muted">
        큐레이터나 가게가 과금·되돌림·노쇼 기록에 낸 이의예요. 가게 기록을 먼저 믿되, 예약 대화·가게의 노쇼 비율·양쪽 설명을 보고 판단하세요. ‘큐레이터에게 지급’은 가게
        잔액에서 금액을 빼 수수료를 뗀 몫을 큐레이터에게, ‘가게에 환불’은 가게 잔액을 돌려주고 큐레이터 몫을 줄여요.
      </p>
      <label className="flex items-center gap-2 text-[14px]">
        <input type="checkbox" checked={open} onChange={(e) => setOpen(e.target.checked)} /> 처리 안 한 것만
      </label>
      {msg && <p role="status" className="text-[14px] text-teal">{msg}</p>}
      {rows.length === 0 && <p className="text-[14px] text-muted">없어요.</p>}
      <ul className="grid gap-3">
        {rows.map((d) => {
          const f = form[d.id] ?? { action: "reject", amount: "", note: "" };
          const set = (patch: Partial<typeof f>) => setForm({ ...form, [d.id]: { ...f, ...patch } });
          return (
            <li key={d.id} className="rounded-xl border border-rule p-4 text-[14px]">
              <p className="flex flex-wrap items-center gap-2">
                <b>{d.place_name}</b>
                <span className="rounded-full bg-surface px-2 py-0.5 text-[12px]">{d.filer_role === "curator" ? "큐레이터" : "가게"}가 제기 · @{d.filer}</span>
                {d.curator && <span className="text-[12px] text-muted">관련 큐레이터 @{d.curator}</span>}
                <span className="ml-auto text-[12px] text-muted">{new Date(d.created_at).toLocaleString("ko-KR")}</span>
              </p>
              <p className="mt-2 whitespace-pre-wrap">{d.reason}</p>
              <p className="mt-2 text-[12px] text-muted">
                {d.charge && `과금: ${d.charge.model} ${d.charge.amount} (${new Date(d.charge.at).toLocaleDateString("ko-KR")}) · `}
                {d.reservation && `예약: ${d.reservation.visit_date} ${d.reservation.visit_time ?? ""} ${d.reservation.party_size}명 · ${d.reservation.status}${d.reservation.cancelled_by ? `(${d.reservation.cancelled_by})` : ""} · `}
                가게 노쇼·취소 비율 {pct(d.store_rate)} / 주변 {pct(d.peer_rate)}
              </p>
              {d.status === "open" ? (
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <select value={f.action} onChange={(e) => set({ action: e.target.value })} className="field !w-auto !py-1">
                    <option value="reject">받아들이지 않음</option>
                    <option value="pay_curator">큐레이터에게 지급</option>
                    <option value="refund_business">가게에 환불</option>
                  </select>
                  {f.action !== "reject" && (
                    <input value={f.amount} onChange={(e) => set({ amount: e.target.value })} inputMode="decimal" placeholder="금액" className="field !w-24 !py-1" />
                  )}
                  <input value={f.note} onChange={(e) => set({ note: e.target.value })} placeholder="결정 이유(양쪽에 보여요)" className="field min-w-[200px] flex-1 !py-1" />
                  <button type="button" onClick={() => resolve(d)} className="btn-primary !px-3 !py-1 !text-[13px]">처리</button>
                </div>
              ) : (
                <p className="mt-2 text-[13px]">
                  <b>{d.status === "resolved" ? "처리함" : "받아들이지 않음"}</b>
                  {d.adjustment != null && ` · 조정 ${d.adjustment}`}
                  {d.resolution && ` · ${d.resolution}`}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
