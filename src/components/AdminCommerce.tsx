"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { money } from "./console/ui";

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

  async function decide(b: Biz, status: string) {
    const note = status === "approved" ? null : prompt(status === "rejected" ? "반려 사유(가게에 보여요)" : "정지 사유", b.review_note ?? "") ?? undefined;
    if (note === undefined) return;
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
              {b.status === "pending" && <button type="button" onClick={() => decide(b, "rejected")} className="btn-quiet !px-3 !py-1 !text-[13px]">반려</button>}
              {b.status === "approved" && <button type="button" onClick={() => decide(b, "suspended")} className="btn-quiet !px-3 !py-1 !text-[13px]">정지</button>}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── 광고비 충전: 입금 확인 ─────────────────────────
type Topup = { id: string; amount: number; currency: string; method: string; status: string; reference: string | null; created_at: string; biz: { place_name: string; business_name: string; contact_phone: string } | null };

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

  async function mark(t: Topup, status: "paid" | "cancelled") {
    const reference = status === "paid" ? prompt("입금 확인 메모(입금자명·거래 번호)", t.reference ?? "") : null;
    if (status === "paid" && reference === null) return;
    await supabase.from("biz_topups").update({ status, reference, paid_at: status === "paid" ? new Date().toISOString() : null }).eq("id", t.id);
    load();
  }

  return (
    <section className="grid gap-3">
      <p className="text-[13px] text-muted">가게가 충전을 요청하면 입금 방법을 안내하고, 입금이 확인되면 ‘입금 확인’을 누르세요. 그때부터 잔액으로 과금돼요.</p>
      {rows.length === 0 && <p className="text-[14px] text-muted">없어요.</p>}
      <ul className="divide-y divide-rule text-[14px]">
        {rows.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center gap-2 py-2">
            <span className="tabular-nums text-muted">{new Date(t.created_at).toLocaleDateString("ko-KR")}</span>
            <b>{t.biz?.place_name}</b>
            <span className="text-[12px] text-muted">{t.biz?.business_name} · {t.biz?.contact_phone}</span>
            <b className="tabular-nums">{money(t.amount, t.currency)}</b>
            <span className={t.status === "paid" ? "text-teal" : t.status === "cancelled" ? "text-muted" : "text-pin"}>
              {t.status === "paid" ? `입금 확인${t.reference ? ` (${t.reference})` : ""}` : t.status === "cancelled" ? "취소" : "입금 대기"}
            </span>
            {t.status === "requested" && (
              <span className="ml-auto flex gap-2">
                <button type="button" onClick={() => mark(t, "paid")} className="btn-primary !px-3 !py-1 !text-[13px]">입금 확인</button>
                <button type="button" onClick={() => mark(t, "cancelled")} className="btn-quiet !px-3 !py-1 !text-[13px]">취소</button>
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

  async function decide(r: Req, status: "paid" | "rejected") {
    const text = prompt(status === "paid" ? "송금 거래 번호(Wise·PayPal·은행)" : "반려 사유(큐레이터에게 보여요)", "");
    if (text === null) return;
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
                  <button type="button" onClick={() => decide(r, "paid")} className="btn-primary !px-3 !py-1 !text-[13px]">지급함</button>
                  <button type="button" onClick={() => decide(r, "rejected")} className="btn-quiet !px-3 !py-1 !text-[13px]">반려</button>
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
