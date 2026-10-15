"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Panel, PanelLoading } from "./shell/Panel";
import { useShell } from "./shell/context";
import { ConfirmButton } from "./console/ui";

// 예약 가능 시간: {"0":[["11:00","21:00"]], ...} 0=일요일. 비어 있으면 아무 때나.
export type Hours = Record<string, [string, string][]>;
type OfferInfo = { business: string; place_name: string; message: string | null; hours: Hours; slot: number; max_party: number };

export const DAYS = ["일", "월", "화", "수", "목", "금", "토"];

function toMin(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function toTime(m: number) {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
// 그 날 고를 수 있는 시각들(구간 시작부터 끝 직전까지 slot분 간격)
export function slotsFor(hours: Hours, slot: number, date: string): string[] | null {
  if (!hours || Object.keys(hours).length === 0) return null;
  const dow = new Date(`${date}T00:00:00`).getDay();
  const ranges = hours[String(dow)] ?? [];
  const out: string[] = [];
  for (const [a, b] of ranges) for (let m = toMin(a); m < toMin(b); m += slot) out.push(toTime(m));
  return out;
}
export function openDaysText(hours: Hours) {
  if (!hours || Object.keys(hours).length === 0) return "언제든 문의 가능";
  return DAYS.map((d, i) => ((hours[String(i)] ?? []).length ? d : null)).filter(Boolean).join("·");
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// 장소 카드의 '예약 문의' 버튼: 가게가 예약 기능을 켜 두었으면 어디서 보든(리스트·검색) 보인다.
export function ReserveButton({ placeId, itemId, onOpen, className = "btn-primary" }: { placeId: string; itemId?: string; onOpen?: () => void; className?: string }) {
  const [offer, setOffer] = useState<OfferInfo | null>(null);
  useEffect(() => {
    if (!placeId) return;
    let alive = true;
    createClient()
      .rpc("reservation_offer", { p_place: placeId })
      .then(({ data }) => alive && setOffer((data as OfferInfo | null) ?? null));
    return () => {
      alive = false;
    };
  }, [placeId]);
  if (!offer || !placeId) return null;
  return (
    // 누르면 장소 카드·미리보기를 닫아 예약 화면을 가리지 않게 한다
    <Link href={`/reserve/${encodeURIComponent(placeId)}${itemId ? `?item=${itemId}` : ""}`} onClick={onOpen} className={className}>
      예약 문의
    </Link>
  );
}

// 예약 문의 보내기(로그인 필요). 가게가 정한 요일·시간대 안에서만 고를 수 있다.
export function ReserveForm({ placeId, itemId }: { placeId: string; itemId: string | null }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { me } = useShell();
  const [offer, setOffer] = useState<OfferInfo | null | undefined>(undefined);
  const [f, setF] = useState({ name: "", phone: "", date: today(), time: "", party: "2", note: "" });
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (me === null) router.replace(`/login?next=${encodeURIComponent(`/reserve/${placeId}${itemId ? `?item=${itemId}` : ""}`)}`);
    if (!me) return;
    supabase.rpc("reservation_offer", { p_place: placeId }).then(({ data }) => {
      setOffer((data as OfferInfo | null) ?? null);
      setF((x) => ({ ...x, name: x.name || me.displayName }));
    });
  }, [me, supabase, placeId, itemId, router]);

  const slots = offer ? slotsFor(offer.hours, offer.slot, f.date) : null;
  const closed = !!slots && slots.length === 0;

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!f.name.trim() || f.phone.replace(/[^0-9]/g, "").length < 8) return setErr("이름과 연락처(숫자 8자리 이상)를 적어 주세요.");
    if (closed) return setErr("이 날은 예약을 받지 않아요. 다른 날을 골라 주세요.");
    if (slots && !f.time) return setErr("시간을 골라 주세요.");
    setState("sending");
    const { error } = await supabase.rpc("request_reservation", {
      p_place: placeId, p_item: itemId, p_name: f.name, p_phone: f.phone, p_date: f.date, p_time: f.time,
      p_party: Number(f.party) || 2, p_note: f.note,
    });
    if (error) {
      setState("idle");
      const m = error.message;
      return setErr(
        m.includes("too many") ? "하루에 5건까지 문의할 수 있어요."
          : m.includes("past date") ? "오늘 이후 날짜를 고르세요."
            : m.includes("too far") ? "90일 안의 날짜만 문의할 수 있어요."
              : m.includes("closed day") ? "이 날은 예약을 받지 않아요."
                : m.includes("closed time") || m.includes("time required") ? "예약 가능한 시간을 골라 주세요."
                  : m.includes("party size") ? `인원은 ${offer?.max_party ?? 20}명까지 문의할 수 있어요.`
                    : m.includes("own business") ? "내 가게에는 문의할 수 없어요."
                      : m.includes("no reservation") ? "이 가게는 지금 예약 문의를 받지 않아요."
                        : "보내지 못했어요. 잠시 후 다시 시도하세요.",
      );
    }
    setState("sent");
  }

  if (offer === undefined) return <PanelLoading />;
  if (offer === null)
    return (
      <Panel title="예약 문의">
        <p className="px-5 py-6 text-[15px] text-muted">이 가게는 지금 PinWith로 예약 문의를 받지 않아요.</p>
      </Panel>
    );

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF({ ...f, [k]: e.target.value, ...(k === "date" ? { time: "" } : {}) });
  return (
    <Panel title={`예약 문의 · ${offer.place_name}`}>
      <div className="px-5 pb-10 pt-4">
        {state === "sent" ? (
          <div className="py-4">
            <p className="text-[17px] font-semibold text-ink">문의를 보냈어요.</p>
            <p className="mt-1 text-[14px] text-muted">{offer.place_name}에서 확인하고 답하면 알림으로 알려 드려요. 확정 전까지는 예약이 아니에요.</p>
            <div className="mt-4 flex gap-2">
              <Link href="/me/reservations" className="btn-primary">내 예약 문의 보기</Link>
              <button type="button" onClick={() => router.back()} className="btn-quiet">돌아가기</button>
            </div>
          </div>
        ) : (
          <form onSubmit={send} className="grid gap-3">
            <p className="text-[14px] text-ink/80"><b>{offer.place_name}</b>에 방문 예약을 문의해요. 가게가 확인하고 확정해 줘요.</p>
            <p className="text-[13px] text-muted">예약 받는 요일: {openDaysText(offer.hours)}</p>
            {offer.message && <p className="rounded-lg bg-surface px-3 py-2 text-[13px] text-ink/80">가게 안내: {offer.message}</p>}
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1 text-[13px] font-semibold">이름<input value={f.name} onChange={set("name")} className="field" autoComplete="name" required /></label>
              <label className="grid gap-1 text-[13px] font-semibold">연락처<input value={f.phone} onChange={set("phone")} className="field" inputMode="tel" autoComplete="tel" required /></label>
            </div>
            <div className="grid grid-cols-[1.4fr_1fr_0.7fr] gap-2">
              <label className="grid gap-1 text-[13px] font-semibold">날짜<input type="date" min={today()} value={f.date} onChange={set("date")} className="field" required /></label>
              <label className="grid gap-1 text-[13px] font-semibold">
                시간
                {slots ? (
                  <select value={f.time} onChange={set("time")} disabled={closed} className="field">
                    <option value="">{closed ? "휴무" : "고르기"}</option>
                    {slots.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                ) : (
                  <input type="time" value={f.time} onChange={set("time")} className="field" />
                )}
              </label>
              <label className="grid gap-1 text-[13px] font-semibold">
                인원
                <select value={f.party} onChange={set("party")} className="field">
                  {Array.from({ length: offer.max_party }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
            </div>
            {closed && <p className="text-[13px] text-pin">{DAYS[new Date(`${f.date}T00:00:00`).getDay()]}요일은 예약을 받지 않아요.</p>}
            <label className="grid gap-1 text-[13px] font-semibold">요청 사항(선택)<textarea value={f.note} onChange={set("note")} rows={2} maxLength={500} className="field" /></label>
            <p className="text-[12px] text-muted">이름과 연락처는 이 가게에만 전달돼요(개인정보처리방침 참고). 확정 전에도 가게와 메시지를 주고받을 수 있어요.</p>
            {err && <p role="alert" className="text-[14px] text-pin">{err}</p>}
            <button disabled={state === "sending"} className="btn-primary justify-center !py-3 disabled:opacity-50">
              {state === "sending" ? "보내는 중" : "예약 문의 보내기"}
            </button>
            <Link href="/me/reservations" className="text-center text-[13px] text-muted underline">내 예약 문의 전체 보기</Link>
          </form>
        )}
      </div>
    </Panel>
  );
}

// 예약 문의 대화(손님·가게 공용)
type Msg = { id: number; sender_id: string | null; body: string; created_at: string };
export function ReservationThread({ reservationId, meId, otherLabel }: { reservationId: string; meId: string; otherLabel: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const { data } = await supabase.from("reservation_messages").select("id, sender_id, body, created_at").eq("reservation_id", reservationId).order("created_at");
    setMsgs((data as Msg[]) ?? []);
  }, [supabase, reservationId]);
  useEffect(() => {
    // 열 때 읽고, 열려 있는 동안 10초마다 새 메시지를 확인한다
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const t = window.setInterval(load, 10000);
    return () => window.clearInterval(t);
  }, [load]);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    const { error } = await supabase.rpc("send_reservation_message", { p_id: reservationId, p_body: text });
    setBusy(false);
    if (!error) {
      setText("");
      load();
    }
  }
  return (
    <div className="mt-2 rounded-lg bg-surface p-2">
      {msgs.length === 0 && <p className="px-1 text-[12px] text-muted">아직 주고받은 메시지가 없어요.</p>}
      <ul className="grid gap-1.5">
        {msgs.map((m) => {
          const mine = m.sender_id === meId;
          return (
            <li key={m.id} className={`max-w-[85%] rounded-lg px-2.5 py-1.5 text-[13px] ${mine ? "ml-auto bg-teal text-white" : "bg-white text-ink"}`}>
              {!mine && <span className="block text-[11px] text-muted">{otherLabel}</span>}
              <span className="whitespace-pre-wrap">{m.body}</span>
              <span className={`block text-right text-[10px] ${mine ? "text-white/70" : "text-muted"}`}>
                {new Date(m.created_at).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" })}
              </span>
            </li>
          );
        })}
      </ul>
      <form onSubmit={send} className="mt-2 flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder="메시지 보내기" className="field min-w-0 flex-1 !py-1.5" />
        <button disabled={busy || !text.trim()} className="btn-primary !px-3 !py-1.5 !text-[13px] disabled:opacity-40">보내기</button>
      </form>
    </div>
  );
}

// 프로필 → 내 예약 문의: 지금까지 보낸 문의, 상태, 가게와의 대화, 취소
type Mine = {
  id: string; visit_date: string; visit_time: string | null; party_size: number; status: string; reply: string | null; created_at: string;
  business: { place_name: string; place_id: string } | null;
};
const ST: Record<string, string> = { new: "답 기다리는 중", confirmed: "확정", declined: "어렵다고 답함", visited: "방문 완료", no_show: "노쇼", cancelled: "취소" };

export function MyReservations() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { me } = useShell();
  const [rows, setRows] = useState<Mine[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [ownsBiz, setOwnsBiz] = useState(false);
  const load = useCallback(async () => {
    if (!me) return;
    const [{ data }, { count }] = await Promise.all([
      supabase
        .from("reservations")
        .select("id, visit_date, visit_time, party_size, status, reply, created_at, business:businesses(place_name, place_id)")
        .eq("user_id", me.id)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("businesses").select("id", { count: "exact", head: true }).eq("owner_id", me.id).eq("status", "approved"),
    ]);
    setRows((data as unknown as Mine[]) ?? []);
    setOwnsBiz((count ?? 0) > 0);
  }, [supabase, me]);
  useEffect(() => {
    if (me === null) router.replace("/login?next=/me/reservations");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [me, router, load]);

  async function cancel(id: string) {
    await supabase.rpc("cancel_reservation", { p_id: id });
    load();
  }

  if (!rows || !me) return <PanelLoading />;
  return (
    <Panel title="내 예약 문의">
      <div className="px-5 pb-10 pt-3">
        {ownsBiz && (
          <p className="mb-3 rounded-lg bg-surface px-3 py-2 text-[13px]">
            내 가게로 들어온 예약 문의는 <Link href="/biz/place" className="font-semibold text-teal underline">가게 콘솔</Link>에서 봐요.
          </p>
        )}
        {rows.length === 0 ? (
          <p className="py-6 text-[14px] text-muted">아직 보낸 예약 문의가 없어요. 장소 카드의 ‘예약 문의’로 보낼 수 있어요.</p>
        ) : (
          <ul className="divide-y divide-rule">
            {rows.map((r) => (
              <li key={r.id} className="py-3 text-[14px]">
                <p className="flex flex-wrap items-center gap-x-2">
                  <b>{r.business?.place_name}</b>
                  <span>{r.visit_date.slice(5).replace("-", "/")} {r.visit_time ?? ""} · {r.party_size}명</span>
                  <span className={`ml-auto text-[13px] ${r.status === "confirmed" || r.status === "visited" ? "text-teal" : r.status === "declined" ? "text-pin" : "text-muted"}`}>
                    {ST[r.status]}
                  </span>
                </p>
                {r.reply && <p className="mt-1 text-[13px] text-ink/75">가게: {r.reply}</p>}
                <div className="mt-1 flex flex-wrap gap-3 text-[12px]">
                  <button type="button" onClick={() => setOpen(open === r.id ? null : r.id)} className="text-teal underline">
                    {open === r.id ? "대화 닫기" : "가게와 대화"}
                  </button>
                  {(r.status === "new" || r.status === "confirmed") && (
                    <ConfirmButton label="취소" className="text-muted underline" question="이 예약 문의를 취소할까요?" confirmLabel="취소하기" onConfirm={() => cancel(r.id)} />
                  )}
                </div>
                {open === r.id && <ReservationThread reservationId={r.id} meId={me.id} otherLabel={r.business?.place_name ?? "가게"} />}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}
