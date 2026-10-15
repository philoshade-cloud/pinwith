"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Panel, PanelLoading } from "./shell/Panel";
import { useShell } from "./shell/context";

type OfferInfo = { business: string; place_name: string; message: string | null };

// 장소 카드의 '예약 문의' 버튼: 이 장소의 가게가 PinWith로 예약 문의를 받을 때만 보인다
export function ReserveButton({ itemId, placeId }: { itemId: string; placeId: string }) {
  const [offer, setOffer] = useState<OfferInfo | null>(null);
  useEffect(() => {
    let alive = true;
    createClient()
      .rpc("reservation_offer", { p_place: placeId })
      .then(({ data }) => alive && setOffer((data as OfferInfo | null) ?? null));
    return () => {
      alive = false;
    };
  }, [placeId]);
  if (!offer) return null;
  return (
    <Link href={`/reserve/${itemId}`} className="btn-primary">
      예약 문의
    </Link>
  );
}

type Mine = { id: string; visit_date: string; visit_time: string | null; party_size: number; status: string; reply: string | null; created_at: string; business: { place_name: string } | null };
const ST: Record<string, string> = { new: "답 기다리는 중", confirmed: "확정", declined: "어렵다고 답함", visited: "방문 완료", no_show: "노쇼", cancelled: "취소" };

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// 예약 문의 보내기(로그인 필요). 가게가 답하면 알림으로 알려준다.
export function ReserveForm({ itemId }: { itemId: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { me } = useShell();
  const [item, setItem] = useState<{ title: string; placeId: string } | null | undefined>(undefined);
  const [offer, setOffer] = useState<OfferInfo | null>(null);
  const [f, setF] = useState({ name: "", phone: "", date: today(), time: "", party: "2", note: "" });
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [err, setErr] = useState("");
  const [mine, setMine] = useState<Mine[]>([]);

  const loadMine = useCallback(async () => {
    const { data } = await supabase
      .from("reservations")
      .select("id, visit_date, visit_time, party_size, status, reply, created_at, business:businesses(place_name)")
      .order("created_at", { ascending: false })
      .limit(10);
    setMine((data as unknown as Mine[]) ?? []);
  }, [supabase]);

  useEffect(() => {
    if (me === null) router.replace(`/login?next=/reserve/${itemId}`);
    if (!me) return;
    (async () => {
      const { data: it } = await supabase.from("list_items").select("custom_title, place_id").eq("id", itemId).maybeSingle();
      if (!it) return setItem(null);
      setItem({ title: it.custom_title as string, placeId: it.place_id as string });
      const { data: o } = await supabase.rpc("reservation_offer", { p_place: it.place_id });
      setOffer((o as OfferInfo | null) ?? null);
      setF((x) => ({ ...x, name: x.name || me.displayName }));
      loadMine();
    })();
  }, [me, supabase, itemId, router, loadMine]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!f.name.trim() || f.phone.trim().length < 5) return setErr("이름과 연락처를 적어 주세요.");
    setState("sending");
    const { error } = await supabase.rpc("request_reservation", {
      p_item: itemId, p_name: f.name, p_phone: f.phone, p_date: f.date, p_time: f.time, p_party: Number(f.party) || 2, p_note: f.note,
    });
    if (error) {
      setState("idle");
      const m = error.message;
      return setErr(
        m.includes("too many") ? "하루에 5건까지 문의할 수 있어요." : m.includes("past date") ? "오늘 이후 날짜를 고르세요."
          : m.includes("own business") ? "내 가게에는 문의할 수 없어요." : m.includes("no reservation") ? "이 가게는 지금 예약 문의를 받지 않아요." : "보내지 못했어요. 잠시 후 다시 시도하세요.",
      );
    }
    setState("sent");
    loadMine();
  }

  async function cancel(id: string) {
    if (!confirm("이 예약 문의를 취소할까요?")) return;
    await supabase.rpc("cancel_reservation", { p_id: id });
    loadMine();
  }

  if (item === undefined) return <PanelLoading />;
  if (item === null || !offer)
    return (
      <Panel title="예약 문의">
        <p className="px-5 py-6 text-[15px] text-muted">{item === null ? "장소를 찾지 못했어요." : "이 가게는 지금 PinWith로 예약 문의를 받지 않아요."}</p>
      </Panel>
    );

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <Panel title={`예약 문의 · ${item.title}`}>
      <div className="px-5 pb-10 pt-4">
        {state === "sent" ? (
          <div className="py-4">
            <p className="text-[17px] font-semibold text-ink">문의를 보냈어요.</p>
            <p className="mt-1 text-[14px] text-muted">{offer.place_name}에서 확인하고 답하면 알림으로 알려 드려요. 확정 전까지는 예약이 아니에요.</p>
            <button type="button" onClick={() => router.back()} className="btn-quiet mt-4">돌아가기</button>
          </div>
        ) : (
          <form onSubmit={send} className="grid gap-3">
            <p className="text-[14px] text-ink/80"><b>{offer.place_name}</b>에 방문 예약을 문의해요. 가게가 확인하고 확정해 줘요.</p>
            {offer.message && <p className="rounded-lg bg-surface px-3 py-2 text-[13px] text-ink/80">가게 안내: {offer.message}</p>}
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1 text-[13px] font-semibold">이름<input value={f.name} onChange={set("name")} className="field" autoComplete="name" required /></label>
              <label className="grid gap-1 text-[13px] font-semibold">연락처<input value={f.phone} onChange={set("phone")} className="field" inputMode="tel" autoComplete="tel" required /></label>
            </div>
            <div className="grid grid-cols-[1.4fr_1fr_0.6fr] gap-2">
              <label className="grid gap-1 text-[13px] font-semibold">날짜<input type="date" min={today()} value={f.date} onChange={set("date")} className="field" required /></label>
              <label className="grid gap-1 text-[13px] font-semibold">시간<input type="time" value={f.time} onChange={set("time")} className="field" /></label>
              <label className="grid gap-1 text-[13px] font-semibold">인원<input inputMode="numeric" value={f.party} onChange={set("party")} className="field" /></label>
            </div>
            <label className="grid gap-1 text-[13px] font-semibold">요청 사항(선택)<textarea value={f.note} onChange={set("note")} rows={2} maxLength={500} className="field" /></label>
            <p className="text-[12px] text-muted">이름과 연락처는 이 가게에만 전달돼요.</p>
            {err && <p role="alert" className="text-[14px] text-pin">{err}</p>}
            <button disabled={state === "sending"} className="btn-primary justify-center !py-3 disabled:opacity-50">
              {state === "sending" ? "보내는 중" : "예약 문의 보내기"}
            </button>
          </form>
        )}
        {mine.length > 0 && (
          <section className="mt-8 border-t border-rule pt-4">
            <h2 className="text-[15px] font-semibold">내 예약 문의</h2>
            <ul className="mt-2 divide-y divide-rule text-[14px]">
              {mine.map((r) => (
                <li key={r.id} className="py-2">
                  <p>
                    <b>{r.business?.place_name}</b> · {r.visit_date.slice(5).replace("-", "/")} {r.visit_time ?? ""} · {r.party_size}명 ·{" "}
                    <span className={r.status === "confirmed" ? "text-teal" : r.status === "declined" ? "text-pin" : "text-muted"}>{ST[r.status]}</span>
                  </p>
                  {r.reply && <p className="text-[13px] text-ink/75">가게: {r.reply}</p>}
                  {(r.status === "new" || r.status === "confirmed") && (
                    <button type="button" onClick={() => cancel(r.id)} className="text-[12px] text-muted underline">취소</button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Panel>
  );
}
