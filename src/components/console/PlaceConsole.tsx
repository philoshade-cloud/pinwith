"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { loadPlacesLibrary } from "@/lib/google";
import { PAY_COUNTRIES } from "@/lib/payments";
import { DAYS, ReservationThread } from "../Reservation";
import { PushToggle } from "../PushToggle";
import { PlaceSearchBox, type FoundPlace } from "../PlaceSearch";
import { ConfirmButton, count, DetailHeader, money, Msg, MODEL, Period, Stat, Tabs, useAuthed, useConsoleNav } from "./ui";

type Business = {
  id: string; place_id: string; place_name: string; place_address: string | null; business_name: string; reg_number: string | null;
  contact_name: string; contact_phone: string; role: "owner" | "manager"; doc_path: string | null;
  status: "pending" | "approved" | "rejected" | "suspended"; review_note: string | null; created_at: string;
  reservations_enabled: boolean; reservation_hours: Record<string, [string, string][]>; reservation_slot_minutes: number;
  reservation_max_party: number; reservation_note: string | null;
};
const STATUS: Record<Business["status"], string> = { pending: "확인 중", approved: "인증됨", rejected: "반려", suspended: "정지" };

// 가게 콘솔: 가게 인증 신청 → 승인 뒤 과금 모델, 성과, 광고비
export function PlaceConsole() {
  const { user, supabase } = useAuthed("/biz/place");
  const [list, setList] = useState<Business[] | null>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const [applying, setApplying] = useState<Business | "new" | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from("businesses").select("*").order("created_at");
    const rows = (data as Business[]) ?? [];
    setList(rows);
    setCurrent((c) => c ?? rows.find((b) => b.status === "approved")?.id ?? rows[0]?.id ?? null);
  }, [supabase]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (user) load();
  }, [user, load]);

  if (!user || !list) return <p className="text-muted">불러오는 중…</p>;
  if (applying || list.length === 0)
    return (
      <Apply
        userId={user.id}
        initial={applying === "new" || !applying ? null : applying}
        onDone={() => {
          setApplying(null);
          load();
        }}
        onCancel={list.length ? () => setApplying(null) : undefined}
      />
    );

  const b = list.find((x) => x.id === current) ?? list[0];
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-[26px] font-semibold text-ink">가게 콘솔</h1>
        {list.length > 1 && (
          <select value={b.id} onChange={(e) => setCurrent(e.target.value)} className="field !w-auto !py-1.5">
            {list.map((x) => (
              <option key={x.id} value={x.id}>{x.place_name} · {STATUS[x.status]}</option>
            ))}
          </select>
        )}
        <button type="button" onClick={() => setApplying("new")} className="btn-quiet ml-auto !py-1.5">가게 추가</button>
      </div>
      <p className="mt-1 text-[14px] text-muted">
        {b.place_name} · {b.business_name} · <b className={b.status === "approved" ? "text-teal" : "text-pin"}>{STATUS[b.status]}</b>
      </p>
      {b.status === "approved" ? (
        <Approved b={b} reloadBiz={load} />
      ) : (
        <div className="mt-6 max-w-[560px] rounded-xl bg-surface p-4 text-[14px]">
          {b.status === "pending" && (
            <p>
              운영자가 확인하고 있어요. 사업자등록증과 구글 지도에 등록된 가게 전화번호로 실제 주인(또는 관리자)인지 확인한 뒤 승인해요. 보통 1~2 영업일 걸려요.
            </p>
          )}
          {b.status === "rejected" && (
            <>
              <p className="font-semibold text-pin">반려됐어요</p>
              {b.review_note && <p className="mt-1">사유: {b.review_note}</p>}
              <button type="button" onClick={() => setApplying(b)} className="btn-primary mt-3">고쳐서 다시 신청</button>
            </>
          )}
          {b.status === "suspended" && <p>계정이 정지됐어요. 문의·신고하기로 연락 주세요.</p>}
        </div>
      )}
    </div>
  );
}

// ── 인증 신청 ─────────────────────────
type Picked = { id: string; name: string; address: string; lat: number | null; lng: number | null };

function Apply({ userId, initial, onDone, onCancel }: { userId: string; initial: Business | null; onDone: () => void; onCancel?: () => void }) {
  const { supabase } = useAuthed("/biz/place");
  const [place, setPlace] = useState<Picked | null>(
    initial ? { id: initial.place_id, name: initial.place_name, address: initial.place_address ?? "", lat: null, lng: null } : null,
  );
  const [results, setResults] = useState<FoundPlace[]>([]);
  const [f, setF] = useState({
    business_name: initial?.business_name ?? "", reg_number: initial?.reg_number ?? "", contact_name: initial?.contact_name ?? "",
    contact_phone: initial?.contact_phone ?? "", role: initial?.role ?? ("owner" as "owner" | "manager"),
  });
  const [file, setFile] = useState<File | null>(null);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function pickId(id: string) {
    try {
      const lib = (await loadPlacesLibrary()) as unknown as {
        Place: new (o: { id: string }) => {
          fetchFields: (o: { fields: string[] }) => Promise<unknown>;
          displayName?: string; formattedAddress?: string; location?: { lat: () => number; lng: () => number };
        };
      };
      const p = new lib.Place({ id });
      await p.fetchFields({ fields: ["displayName", "formattedAddress", "location"] });
      setPlace({ id, name: p.displayName ?? "", address: p.formattedAddress ?? "", lat: p.location?.lat() ?? null, lng: p.location?.lng() ?? null });
      setResults([]);
    } catch {
      setMsg("가게 정보를 불러오지 못했어요. 다시 골라 주세요.");
    }
  }

  // 이 가게가 이미 인증됐는지, 내가 이미 신청했는지
  const [claim, setClaim] = useState<"free" | "taken" | "mine_pending" | "mine_approved" | null>(null);
  useEffect(() => {
    if (!place) return;
    let alive = true;
    supabase.rpc("place_claim_status", { p_place: place.id }).then(({ data }) => alive && setClaim((data as typeof claim) ?? "free"));
    return () => {
      alive = false;
    };
  }, [supabase, place]);
  const claimBlock =
    place && claim && claim !== "free" && !(initial && claim === "mine_pending")
      ? claim === "taken"
        ? "이 가게는 이미 다른 계정이 인증했어요. 실제 주인인데 모르는 일이라면 ‘문의·신고하기’로 알려 주세요. 확인 후 정리해 드려요."
        : claim === "mine_pending"
          ? "이 가게로 이미 신청해 두셨어요. 운영자 확인을 기다려 주세요(보통 1~2 영업일)."
          : "이미 인증된 내 가게예요. 가게 콘솔에서 바로 쓰시면 돼요."
      : null;

  const FILE_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
  const fileProblem = file
    ? file.size > 5 * 1024 * 1024
      ? `파일이 너무 커요(${(file.size / 1024 / 1024).toFixed(1)}MB). 5MB 이하로 줄이거나 사진으로 찍어 올려 주세요.`
      : !FILE_TYPES.includes(file.type)
        ? "JPG·PNG·WEBP 사진이나 PDF만 올릴 수 있어요(아이폰 HEIC 사진은 ‘가장 호환성 높은 형식’으로 바꿔 주세요)."
        : null
    : null;
  const checks: { ok: boolean; text: string }[] = [
    { ok: !!place, text: "가게 고르기(위 검색창에서 이름으로 찾기)" },
    { ok: !!f.business_name.trim(), text: "상호" },
    { ok: !!f.contact_name.trim(), text: "담당자 이름" },
    { ok: f.contact_phone.replace(/[^0-9+]/g, "").length >= 8, text: "연락처(숫자 8자리 이상)" },
    { ok: (!!file && !fileProblem) || (!file && !!initial?.doc_path), text: "사업자등록증 또는 운영 증명 자료" },
    { ok: agree, text: "맨 아래 확인 항목 동의" },
  ];
  const missing = checks.filter((c) => !c.ok);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (claimBlock) return setMsg(claimBlock);
    if (fileProblem) return setMsg(fileProblem);
    if (missing.length) return setMsg(`아직 빠진 것이 있어요: ${missing.map((m) => m.text.replace(/\(.*\)/, "")).join(", ")}`);
    if (!place) return;
    setBusy(true);
    setMsg("");
    let doc = initial?.doc_path ?? null;
    if (file) {
      const ext = (file.name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5);
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("biz-docs").upload(path, file, { contentType: file.type });
      if (error) {
        setBusy(false);
        const m = error.message.toLowerCase();
        return setMsg(
          m.includes("size") || m.includes("large") ? "파일이 5MB를 넘어요. 줄여서 다시 올려 주세요."
            : m.includes("mime") || m.includes("type") ? "이 파일 형식은 올릴 수 없어요. JPG·PNG·WEBP 사진이나 PDF로 올려 주세요."
              : m.includes("jwt") || m.includes("auth") || m.includes("policy") ? "로그인이 풀렸어요. 새로고침 후 다시 로그인해 주세요."
                : "파일을 올리지 못했어요. 인터넷 연결을 확인하고 다시 시도하세요.",
        );
      }
      doc = path;
    }
    const row = {
      place_id: place.id, place_name: place.name, place_address: place.address || null, lat: place.lat, lng: place.lng,
      business_name: f.business_name.trim(), reg_number: f.reg_number.trim() || null, contact_name: f.contact_name.trim(),
      contact_phone: f.contact_phone.trim(), role: f.role, doc_path: doc,
    };
    const { error } = initial
      ? await supabase.from("businesses").update({ ...row, status: "pending" }).eq("id", initial.id)
      : await supabase.from("businesses").insert({ ...row, owner_id: userId });
    setBusy(false);
    if (error) {
      return setMsg(
        error.code === "23514" ? "입력한 내용 중 길이가 맞지 않는 칸이 있어요(상호 120자, 이름 60자, 연락처 5~30자, 사업자번호 40자 이내)."
          : error.code === "42501" ? "로그인이 풀렸거나 권한이 없어요. 새로고침 후 다시 로그인해 주세요."
            : error.code === "23505" ? "이 가게는 이미 인증된 계정이 있어요."
              : error.message.includes("not allowed") ? "지금 상태에서는 고칠 수 없어요(이미 승인됐거나 확인 중이에요)."
                : "신청하지 못했어요. 인터넷 연결을 확인하고 다시 시도하세요.",
      );
    }
    onDone();
  }

  return (
    <section className="mx-auto max-w-[600px]">
      <h1 className="font-display text-[26px] font-semibold text-ink">가게 인증 신청</h1>
      <p className="mt-2 text-[14px] text-muted">
        어느 가게의 주인(또는 관리자)인지 알려 주세요. 운영자가 사업자등록증과 구글 지도에 등록된 가게 전화번호로 확인한 뒤 승인해요.
      </p>
      <form onSubmit={submit} className="mt-6 grid gap-4">
        <div className="grid gap-1 text-[13px] font-semibold">
          가게 찾기
          {place ? (
            <div className="flex items-center gap-3 rounded-lg border border-rule p-3 font-normal">
              <span className="min-w-0 flex-1">
                <b className="block text-[15px]">{place.name}</b>
                <span className="block truncate text-[12px] text-muted">{place.address}</span>
              </span>
              <button type="button" onClick={() => setPlace(null)} className="btn-quiet !py-1 !text-[13px]">바꾸기</button>
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-rule p-1 font-normal">
                <PlaceSearchBox onPick={pickId} onResults={(_, ps) => setResults(ps)} />
              </div>
              <span className="font-normal text-muted">
                구글 지도에 나오는 가게 이름으로 찾아 주세요. 검색이 안 되거나 가게가 나오지 않으면 구글 지도에 먼저 등록돼 있어야 해요. 그래도 안 되면 ‘문의·신고하기’로 가게
                이름과 주소를 보내 주세요.
              </span>
            </>
          )}
          {!place && results.length > 0 && (
            <ul className="mt-1 divide-y divide-rule rounded-lg border border-rule font-normal">
              {results.map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => { setPlace({ id: r.id, name: r.name, address: r.address, lat: r.lat, lng: r.lng }); setResults([]); }} className="block w-full px-3 py-2 text-left hover:bg-surface">
                    <b className="block text-[14px]">{r.name}</b>
                    <span className="block text-[12px] text-muted">{r.address}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Field label="상호(사업자 등록 이름)" value={f.business_name} onChange={(v) => setF({ ...f, business_name: v })} required />
        <Field label="사업자등록번호" value={f.reg_number} onChange={(v) => setF({ ...f, reg_number: v })} placeholder="123-45-67890 (해외는 해당 번호)" />
        <div className="grid grid-cols-2 gap-3">
          <Field label="담당자 이름" value={f.contact_name} onChange={(v) => setF({ ...f, contact_name: v })} required />
          <Field label="연락처" value={f.contact_phone} onChange={(v) => setF({ ...f, contact_phone: v })} required inputMode="tel" />
        </div>
        <label className="grid gap-1 text-[13px] font-semibold">
          나는
          <select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as "owner" | "manager" })} className="field">
            <option value="owner">가게 주인</option>
            <option value="manager">주인에게 맡겨진 관리자·직원</option>
          </select>
        </label>
        <label className="grid gap-1 text-[13px] font-semibold">
          사업자등록증 또는 운영 증명 자료 {initial?.doc_path && <span className="font-normal text-muted">(올린 자료가 있어요. 바꿀 때만 다시 올리세요)</span>}
          <input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-[14px] font-normal" />
          <span className="font-normal text-muted">운영자만 볼 수 있어요. 5MB 이하 사진이나 PDF.</span>
        </label>
        <label className="flex items-start gap-2 text-[13px]">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5" />
          이 가게를 운영하거나 운영자에게 권한을 받았고, 확인을 위해 운영자가 가게 전화번호로 연락할 수 있음에 동의해요.
        </label>
        {claimBlock && <p role="alert" className="rounded-lg bg-surface px-3 py-2 text-[14px] text-pin">{claimBlock}</p>}
        {fileProblem && <p role="alert" className="text-[14px] text-pin">{fileProblem}</p>}
        {missing.length > 0 && (
          <div className="rounded-lg bg-surface px-3 py-2 text-[13px]">
            <p className="font-semibold text-ink">신청하려면 아래가 더 필요해요</p>
            <ul className="mt-1 grid gap-0.5">
              {checks.map((c) => (
                <li key={c.text} className={c.ok ? "text-teal" : "text-ink/80"}>{c.ok ? "✓" : "○"} {c.text}</li>
              ))}
            </ul>
          </div>
        )}
        {msg && <p role="alert" className="text-[14px] text-pin">{msg}</p>}
        <div className="flex gap-2">
          <button disabled={busy} className="btn-primary disabled:opacity-50">{busy ? "보내는 중" : initial ? "다시 신청" : "인증 신청"}</button>
          {onCancel && <button type="button" onClick={onCancel} className="btn-quiet">취소</button>}
        </div>
      </form>
    </section>
  );
}

function Field({ label, value, onChange, ...rest }: { label: string; value: string; onChange: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value">) {
  return (
    <label className="grid gap-1 text-[13px] font-semibold">
      {label}
      <input value={value} onChange={(e) => onChange(e.target.value)} className="field" {...rest} />
    </label>
  );
}

// ── 승인된 가게 ─────────────────────────
type Tab = "offers" | "reservations" | "booking" | "stats" | "billing";
const TABS: { id: Tab; label: string }[] = [
  { id: "reservations", label: "예약 문의" },
  { id: "booking", label: "예약 설정" },
  { id: "offers", label: "과금 모델" },
  { id: "stats", label: "성과" },
  { id: "billing", label: "광고비" },
];
type Dash = {
  currency: string; balance: number; min_rate: number | null; spent_month: number; lists_with_place: number; paid_only_lists: number; attached_lists: number;
  organic: { taps: number; opens: number; nearby: number };
  by_model: { model: string; count: number; cost: number }[];
  reservations: { total: number; new: number; confirmed: number; visited: number; no_show: number; cancelled: number; declined: number; via_curator: number };
  by_list: { list: string; handle: string; slug: string; count: number; cost: number }[];
  daily: { d: string; count: number; cost: number }[];
};

function Approved({ b, reloadBiz }: { b: Business; reloadBiz: () => void }) {
  const { supabase } = useAuthed("/biz/place");
  const nav = useConsoleNav<Tab>("reservations");
  const [days, setDays] = useState(30);
  const [dash, setDash] = useState<Dash | null>(null);
  const reload = useCallback(async () => {
    const { data } = await supabase.rpc("biz_dashboard", { p_business: b.id, p_days: days });
    setDash(data as Dash);
  }, [supabase, b.id, days]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);
  if (!dash) return <p className="mt-6 text-muted">불러오는 중…</p>;

  if (nav.detail) return <BizDetail b={b} dash={dash} kind={nav.detail} onBack={nav.back} reload={reload} />;

  const low = dash.min_rate != null && dash.balance < dash.min_rate;
  return (
    <div className="mt-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="광고비 잔액" value={money(dash.balance, dash.currency)} hint={low ? "잔액이 모자라 과금·노출이 멈췄어요" : undefined} onClick={() => nav.open("balance")} />
        <Stat label="이번 달 쓴 광고비" value={money(dash.spent_month, dash.currency)} onClick={() => nav.open("spent")} />
        <Stat label="우리 가게를 담은 리스트" value={`${count(dash.lists_with_place)}개`} hint={dash.paid_only_lists ? `그중 ${dash.paid_only_lists}개는 광고비가 있을 때만 공개` : undefined} onClick={() => nav.open("lists")} />
        <Stat label="제휴를 붙인 리스트" value={`${count(dash.attached_lists)}건`} onClick={() => nav.open("attached")} />
      </div>
      {low && (
        <p className="mt-3 rounded-lg bg-[#fff7fb] px-3 py-2 text-[13px] text-pin">
          광고비 잔액이 과금 금액보다 적어요. 새 과금이 멈췄고, 큐레이터가 ‘광고비 지급될 때만 공개’로 담은 리스트({dash.paid_only_lists}개)에서는 우리 가게가 보이지 않아요.{" "}
          <button type="button" onClick={() => nav.setTab("billing")} className="font-semibold underline">충전하기</button>
        </p>
      )}
      <div className="mt-4">
        <PushToggle compact />
      </div>
      <div className="mt-6">
        <Tabs tabs={TABS} value={nav.tab} onChange={nav.setTab} />
      </div>
      <div className="mt-5">
        {nav.tab === "reservations" && <Reservations b={b} onChanged={reload} />}
        {nav.tab === "booking" && <BookingSettings b={b} onSaved={reloadBiz} />}
        {nav.tab === "offers" && <Offers b={b} currency={dash.currency} paidOnly={dash.paid_only_lists} />}
        {nav.tab === "stats" && <Stats dash={dash} days={days} setDays={setDays} />}
        {nav.tab === "billing" && <Billing b={b} dash={dash} reload={reload} />}
      </div>
    </div>
  );
}

// ── 대시보드 상자 상세 ─────────────────────────
type Charge = { at: string; model: string; amount: number; list_title: string | null; handle: string | null };
type BizList = { list_id: string; title: string; slug: string; visibility: string; curator_id: string; handle: string; name: string; paid_only: boolean; models: string[]; events_30d: number };

function BizDetail({ b, dash, kind, onBack, reload }: { b: Business; dash: Dash; kind: string; onBack: () => void; reload: () => void }) {
  const { supabase } = useAuthed("/biz/place");
  const [charges, setCharges] = useState<Charge[] | null>(null);
  const [topups, setTopups] = useState<Topup[]>([]);
  const [lists, setLists] = useState<{ lists: BizList[]; blocked: { curator_id: string; handle: string; name: string; at: string }[] } | null>(null);
  const [msg, setMsg] = useState("");
  const load = useCallback(async () => {
    if (kind === "balance" || kind === "spent") {
      const [{ data: c }, { data: t }] = await Promise.all([
        supabase.rpc("biz_charges", { p_business: b.id, p_days: kind === "spent" ? 31 : 365 }),
        supabase.from("biz_topups").select("*").eq("business_id", b.id).order("created_at", { ascending: false }),
      ]);
      const month = new Date();
      const m0 = new Date(month.getFullYear(), month.getMonth(), 1).getTime();
      setCharges(((c as Charge[]) ?? []).filter((x) => kind !== "spent" || new Date(x.at).getTime() >= m0));
      setTopups((t as Topup[]) ?? []);
    } else {
      const { data } = await supabase.rpc("biz_lists", { p_business: b.id });
      setLists(data as NonNullable<typeof lists>);
    }
  }, [supabase, b.id, kind]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function block(l: BizList) {
    const { error } = await supabase.rpc("block_curator", { p_business: b.id, p_curator: l.curator_id });
    setMsg(error ? `차단하지 못했어요. (${error.message})` : `@${l.handle}님을 차단했어요. 그 큐레이터의 리스트에서 우리 가게가 빠졌고, 큐레이터에게 알림이 갔어요.`);
    load();
    reload();
  }
  async function unblock(id: string, handle: string) {
    const { error } = await supabase.rpc("unblock_curator", { p_business: b.id, p_curator: id });
    setMsg(error ? "풀지 못했어요." : `@${handle}님 차단을 풀었어요. 숨겨졌던 리스트에 다시 보여요.`);
    load();
    reload();
  }

  const titles: Record<string, string> = { balance: "광고비 잔액 내역", spent: "이번 달 쓴 광고비", lists: "우리 가게를 담은 리스트", attached: "제휴를 붙인 리스트" };
  return (
    <div className="mt-4 grid gap-4">
      <DetailHeader title={titles[kind] ?? "자세히"} onBack={onBack} />
      <Msg text={msg} />
      {(kind === "balance" || kind === "spent") && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="지금 잔액" value={money(dash.balance, dash.currency)} />
            <Stat label="이번 달 쓴 광고비" value={money(dash.spent_month, dash.currency)} />
            {kind === "balance" && <Stat label="충전 합계" value={money(topups.filter((t) => t.status === "paid").reduce((s, t) => s + Number(t.amount), 0), dash.currency)} />}
          </div>
          {kind === "balance" && (
            <section>
              <h3 className="text-[15px] font-semibold">충전</h3>
              <ul className="mt-2 divide-y divide-rule text-[14px]">
                {topups.length === 0 && <li className="py-2 text-muted">없어요.</li>}
                {topups.map((t) => (
                  <li key={t.id} className="flex flex-wrap gap-2 py-2">
                    <span className="tabular-nums text-muted">{new Date(t.created_at).toLocaleDateString("ko-KR")}</span>
                    <b className="tabular-nums text-teal">+{money(t.amount, t.currency)}</b>
                    <span className="text-[12px] text-muted">{t.status === "paid" ? "반영됨" : t.status === "cancelled" ? "취소" : "대기"} · {t.provider === "bank" ? "계좌 입금" : "카드"}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section>
            <h3 className="text-[15px] font-semibold">과금 기록</h3>
            {!charges ? (
              <p className="text-muted">불러오는 중…</p>
            ) : charges.length === 0 ? (
              <p className="mt-2 text-[14px] text-muted">없어요.</p>
            ) : (
              <table className="mt-2 w-full text-left text-[14px]">
                <thead className="border-b border-rule text-[12px] text-muted">
                  <tr><th className="py-2">때</th><th>종류</th><th>리스트 · 큐레이터</th><th className="text-right">금액</th></tr>
                </thead>
                <tbody>
                  {charges.map((c, i) => (
                    <tr key={i} className="border-b border-rule">
                      <td className="py-1.5 tabular-nums text-[13px]">{new Date(c.at).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" })}</td>
                      <td className="text-[13px]">{MODEL[c.model]?.label.replace(/ 1(회|건)당/, "") ?? c.model}{Number(c.amount) < 0 && " (되돌림)"}</td>
                      <td className="text-[13px]">{c.list_title ?? "-"}{c.handle && <span className="text-muted"> · @{c.handle}</span>}</td>
                      <td className={`text-right tabular-nums ${Number(c.amount) < 0 ? "text-teal" : ""}`}>{Number(c.amount) < 0 ? "+" : "−"}{money(Math.abs(Number(c.amount)), dash.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
      {(kind === "lists" || kind === "attached") && (
        <>
          {kind === "lists" && (
            <p className="text-[13px] text-muted">
              우리 가게를 담은 공개·링크 공개 리스트예요. 원치 않는 큐레이터는 차단할 수 있어요. 차단하면 그 큐레이터의 리스트에서 우리 가게가 빠지고, 풀기 전까지 다시 담을 수
              없으며, 큐레이터에게 알림이 가요.
            </p>
          )}
          {!lists ? (
            <p className="text-muted">불러오는 중…</p>
          ) : (
            <ul className="divide-y divide-rule text-[14px]">
              {lists.lists.filter((l) => kind === "lists" || l.models.length > 0).length === 0 && <li className="py-3 text-muted">없어요.</li>}
              {lists.lists
                .filter((l) => kind === "lists" || l.models.length > 0)
                .map((l) => (
                  <li key={l.list_id} className="flex flex-wrap items-center gap-2 py-3">
                    <span className="min-w-0 flex-1">
                      <Link href={`/@${l.handle}/${l.slug}`} className="font-semibold">{l.title}</Link>
                      <span className="block text-[12px] text-muted">
                        @{l.handle} · 최근 30일 반응 {count(l.events_30d)}
                        {l.models.length > 0 && ` · 제휴: ${l.models.map((m) => MODEL[m]?.label.replace(/ 1(회|건)당/, "")).join(", ")}`}
                        {l.paid_only && " · 광고비 있을 때만 공개"}
                      </span>
                    </span>
                    {kind === "lists" && (
                      <ConfirmButton
                        label="이 큐레이터 차단"
                        question={`@${l.handle}님을 차단할까요?\n그 큐레이터의 리스트에서 우리 가게가 빠지고, 차단을 풀기 전까지 다시 담을 수 없어요. 큐레이터에게 알림이 가요.`}
                        confirmLabel="차단"
                        onConfirm={() => block(l)}
                      />
                    )}
                  </li>
                ))}
            </ul>
          )}
          {kind === "lists" && lists && lists.blocked.length > 0 && (
            <section>
              <h3 className="text-[15px] font-semibold">차단한 큐레이터</h3>
              <ul className="mt-2 divide-y divide-rule text-[14px]">
                {lists.blocked.map((k) => (
                  <li key={k.curator_id} className="flex items-center gap-2 py-2">
                    <span className="flex-1">@{k.handle} <span className="text-[12px] text-muted">{new Date(k.at).toLocaleDateString("ko-KR")}부터</span></span>
                    <button type="button" onClick={() => unblock(k.curator_id, k.handle)} className="btn-quiet !px-3 !py-1 !text-[12px]">차단 풀기</button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

// ── 예약 설정: 수익화와 관계없이 켜고 끄기, 요일·시간대 ─────────────────────────
type Ranges = [string, string][];
function BookingSettings({ b, onSaved }: { b: Business; onSaved: () => void }) {
  const { supabase } = useAuthed("/biz/place");
  const [on, setOn] = useState(b.reservations_enabled);
  const [hours, setHours] = useState<Record<string, Ranges>>(b.reservation_hours ?? {});
  const [slot, setSlot] = useState(b.reservation_slot_minutes ?? 30);
  const [maxParty, setMaxParty] = useState(String(b.reservation_max_party ?? 20));
  const [note, setNote] = useState(b.reservation_note ?? "");
  const [msg, setMsg] = useState("");
  const anytime = Object.keys(hours).length === 0;

  function setDay(d: number, r: Ranges) {
    setHours({ ...hours, [String(d)]: r });
  }
  function toggleHours(v: boolean) {
    setHours(v ? Object.fromEntries([1, 2, 3, 4, 5, 6].map((d) => [String(d), [["11:00", "21:00"]] as Ranges])) : {});
  }

  async function save(enable = on) {
    // 시간이 거꾸로 된 구간은 저장하지 않는다
    for (const [d, rs] of Object.entries(hours))
      for (const [a, z] of rs) if (!a || !z || a >= z) return setMsg(`${DAYS[Number(d)]}요일 시간대를 확인하세요(시작이 끝보다 빨라야 해요).`);
    const mp = Math.max(1, Math.min(100, Number(maxParty) || 20));
    const { error } = await supabase
      .from("businesses")
      .update({ reservations_enabled: enable, reservation_hours: hours, reservation_slot_minutes: slot, reservation_max_party: mp, reservation_note: note.trim() || null })
      .eq("id", b.id);
    setMsg(error ? "저장하지 못했어요." : enable ? "저장했어요. 손님 화면의 예약 문의에 바로 반영돼요." : "예약 문의를 껐어요. 장소 카드에서 버튼이 사라져요.");
    setOn(enable);
    onSaved();
  }

  return (
    <section className="grid max-w-[640px] gap-4">
      <div className="flex items-center gap-3 rounded-xl border border-rule p-4">
        <span className="flex-1">
          <b className="block text-[16px]">PinWith로 예약 문의 받기</b>
          <span className="text-[13px] text-muted">
            켜면 우리 가게의 장소 카드(어떤 리스트에서 보든, 검색해서 보든)에 ‘예약 문의’ 버튼이 생겨요. 수익화(과금 모델)와 관계없이 무료예요.
          </span>
        </span>
        <button type="button" onClick={() => save(!on)} className={on ? "btn-quiet" : "btn-primary"}>{on ? "끄기" : "켜기"}</button>
      </div>
      <div className="rounded-xl border border-rule p-4">
        <p className="text-[15px] font-semibold">예약 받는 요일·시간</p>
        <label className="mt-2 flex items-center gap-2 text-[14px]">
          <input type="checkbox" checked={!anytime} onChange={(e) => toggleHours(e.target.checked)} /> 요일·시간을 정해서 받기(끄면 아무 때나 문의 가능)
        </label>
        {!anytime && (
          <ul className="mt-3 grid gap-2">
            {DAYS.map((d, i) => {
              const rs = hours[String(i)] ?? [];
              return (
                <li key={d} className="flex flex-wrap items-center gap-2 text-[14px]">
                  <span className="w-6 font-semibold">{d}</span>
                  {rs.length === 0 ? (
                    <span className="text-muted">휴무</span>
                  ) : (
                    rs.map((r, k) => (
                      <span key={k} className="flex items-center gap-1">
                        <input type="time" value={r[0]} onChange={(e) => setDay(i, rs.map((x, j) => (j === k ? [e.target.value, x[1]] : x)) as Ranges)} className="field !w-auto !py-1" />
                        ~
                        <input type="time" value={r[1]} onChange={(e) => setDay(i, rs.map((x, j) => (j === k ? [x[0], e.target.value] : x)) as Ranges)} className="field !w-auto !py-1" />
                        <button type="button" onClick={() => setDay(i, rs.filter((_, j) => j !== k))} className="text-muted" aria-label="이 시간대 빼기">✕</button>
                      </span>
                    ))
                  )}
                  {rs.length < 3 && (
                    <button type="button" onClick={() => setDay(i, [...rs, rs.length ? ["17:00", "21:00"] : ["11:00", "21:00"]])} className="text-[12px] text-teal underline">
                      {rs.length ? "+ 시간대" : "받기"}
                    </button>
                  )}
                  {rs.length > 0 && <button type="button" onClick={() => setDay(i, [])} className="text-[12px] text-muted underline">휴무로</button>}
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-3 grid grid-cols-2 gap-3 sm:max-w-[360px]">
          <label className="grid gap-1 text-[13px] font-semibold">
            시간 간격
            <select value={slot} onChange={(e) => setSlot(Number(e.target.value))} className="field">
              <option value={15}>15분</option>
              <option value={30}>30분</option>
              <option value={60}>1시간</option>
            </select>
          </label>
          <Field label="최대 인원" value={maxParty} onChange={setMaxParty} inputMode="numeric" />
        </div>
        <label className="mt-3 grid gap-1 text-[13px] font-semibold">
          손님에게 보일 안내(선택)
          <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} rows={2} className="field" placeholder="예: 6인 이상은 하루 전까지 문의해 주세요." />
        </label>
        <button type="button" onClick={() => save()} className="btn-primary mt-3">저장</button>
      </div>
      <p className="text-[13px] text-muted">
        큐레이터에게 예약 보상을 주고 싶다면 ‘과금 모델’ 탭에서 ‘예약 확정 1건당’을 등록하세요. 그 조건을 붙인 큐레이터의 리스트에서 들어온 문의를 확정할 때만 광고비가
        나가요(잔액이 모자라면 확정할 수 없어요).
      </p>
      <Msg text={msg} />
    </section>
  );
}

const MODELS = ["click", "visit", "reservation"] as const;

type Offer = { id?: string; model: "click" | "visit" | "reservation"; rate: string; monthly_budget: string; message: string; active: boolean };

function Offers({ b, currency, paidOnly }: { b: Business; currency: string; paidOnly: number }) {
  const { supabase } = useAuthed("/biz/place");
  const [rows, setRows] = useState<Record<string, Offer>>({});
  const [fee, setFee] = useState(20);
  const [msg, setMsg] = useState("");
  const load = useCallback(async () => {
    const [{ data }, { data: s }] = await Promise.all([
      supabase.from("biz_offers").select("*").eq("business_id", b.id),
      supabase.from("monetization_settings").select("platform_fee_pct").maybeSingle(),
    ]);
    if (s) setFee(Number(s.platform_fee_pct));
    const out: Record<string, Offer> = {};
    for (const m of MODELS) {
      const o = (data ?? []).find((x) => x.model === m);
      out[m] = o
        ? { id: o.id, model: m, rate: String(o.rate), monthly_budget: o.monthly_budget ? String(o.monthly_budget) : "", message: o.message ?? "", active: o.active }
        : { model: m, rate: "", monthly_budget: "", message: "", active: false };
    }
    setRows(out);
  }, [supabase, b.id]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function save(o: Offer, active: boolean) {
    const rate = Number(o.rate);
    if (!(rate > 0)) return setMsg("금액을 0보다 큰 숫자로 넣으세요.");
    const budget = o.monthly_budget ? Number(o.monthly_budget) : null;
    const row = {
      business_id: b.id, model: o.model, rate, monthly_budget: budget && budget > 0 ? budget : null,
      message: o.message.trim() || null, active, updated_at: new Date().toISOString(),
    };
    const { error } = o.id
      ? await supabase.from("biz_offers").update(row).eq("id", o.id)
      : await supabase.from("biz_offers").insert(row);
    setMsg(error ? "저장하지 못했어요." : active ? "등록했어요. 큐레이터들이 제휴 목록에서 볼 수 있어요." : "해제했어요. 새 과금이 멈춰요.");
    load();
  }

  return (
    <section className="grid gap-4">
      <p className="text-[13px] text-muted">
        큐레이터가 우리 가게가 담긴 리스트에 이 조건을 붙이면, 손님 행동마다 광고비 잔액에서 빠져나가요. 같은 사람은 조건별로 하루 1회만 과금되고, 큐레이터·가게 주인
        본인은 빠져요. 금액의 {fee}%는 PinWith 수수료, 나머지는 큐레이터에게 가요.
      </p>
      <div className="rounded-lg bg-surface px-3 py-2 text-[13px] text-ink/85">
        <b>잔액과 노출</b> — 큐레이터는 우리 가게를 담을 때 ‘광고비 지급될 때만 공개’를 고를 수 있어요. 그렇게 담은 리스트에서는 잔액이 조건 금액보다 적어지면 우리 가게가
        보이지 않고, 충전하면 다시 보여요. 지금 {paidOnly}개 리스트가 이렇게 담았어요. 이 설정을 고르지 않은 큐레이터의 리스트에서는 잔액과 관계없이 계속 보여요(과금만 멈춤).
      </div>
      <Msg text={msg} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {MODELS.map((m) => {
          const o = rows[m];
          if (!o) return null;
          const set = (patch: Partial<Offer>) => setRows({ ...rows, [m]: { ...o, ...patch } });
          return (
            <div key={m} className="rounded-xl border border-rule p-4">
              <div className="flex items-center gap-2">
                <p className="text-[16px] font-semibold">{MODEL[m].label}</p>
                <span className={`ml-auto rounded-full px-2 py-0.5 text-[12px] ${o.active ? "bg-teal text-white" : "bg-surface text-muted"}`}>
                  {o.active ? "등록됨" : "해제됨"}
                </span>
              </div>
              <p className="mt-1 text-[12px] text-muted">{MODEL[m].desc}</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Field label={`1회 금액(${currency})`} value={o.rate} onChange={(v) => set({ rate: v })} inputMode="decimal" />
                <Field label="한 달 예산(선택)" value={o.monthly_budget} onChange={(v) => set({ monthly_budget: v })} inputMode="decimal" placeholder="제한 없음" />
              </div>
              {m === "reservation" && (
                <p className="mt-2 rounded-lg bg-surface px-3 py-2 text-[12px] text-ink/80">
                  예약 문의 버튼 자체는 ‘예약 설정’에서 무료로 켜요. 이 조건은 큐레이터 보상용이에요: 이 조건을 붙인 큐레이터의 리스트에서 들어온 문의를 확정할 때 금액이
                  나가요. 잔액이 모자라면 그런 문의는 확정할 수 없고, 확정 뒤 노쇼·취소로 바꾸면 되돌려 받아요.
                </p>
              )}
              <label className="mt-3 grid gap-1 text-[13px] font-semibold">
                큐레이터에게 한마디(선택)
                <textarea value={o.message} onChange={(e) => set({ message: e.target.value })} maxLength={300} rows={2} className="field" placeholder="예: 대표 메뉴는 들기름 막국수예요. 사진 촬영 환영!" />
              </label>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => save(o, true)} className="btn-primary !py-1.5">{o.active ? "저장" : "등록"}</button>
                {o.active && <button type="button" onClick={() => save(o, false)} className="btn-quiet !py-1.5">해제</button>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Stats({ dash, days, setDays }: { dash: Dash; days: number; setDays: (d: number) => void }) {
  const total = dash.by_model.reduce((s, x) => s + Number(x.cost), 0);
  const max = Math.max(1, ...dash.daily.map((d) => Number(d.count)));
  const r = dash.reservations;
  return (
    <section className="grid gap-6">
      <Period value={days} onChange={setDays} />
      <div>
        <h2 className="text-[15px] font-semibold">과금된 성과 <span className="text-[12px] font-normal text-muted">제휴 큐레이터 리스트에서 생겨 광고비가 나간 것</span></h2>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label={`${days}일 광고비`} value={money(total, dash.currency)} />
          {MODELS.map((m) => {
            const x = dash.by_model.find((y) => y.model === m);
            return <Stat key={m} label={MODEL[m].label.replace(/ 1(회|건)당/, "")} value={`${count(x?.count)}회`} hint={money(x?.cost, dash.currency)} />;
          })}
        </div>
      </div>
      <div>
        <h2 className="text-[15px] font-semibold">과금 없는 성과 <span className="text-[12px] font-normal text-muted">광고비 없이 생긴 반응</span></h2>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="리스트에서 우리 가게 탭" value={`${count(dash.organic.taps)}회`} />
          <Stat label="길찾기·지도 열기" value={`${count(dash.organic.opens)}회`} />
          <Stat label="가게 근처에서 누름" value={`${count(dash.organic.nearby)}회`} />
          <Stat label="예약 문의(제휴 외)" value={`${count(r.total - r.via_curator)}건`} />
        </div>
      </div>
      <div>
        <h2 className="text-[15px] font-semibold">예약 문의</h2>
        <div className="mt-2 grid grid-cols-3 gap-3 sm:grid-cols-6">
          <Stat label="전체" value={count(r.total)} hint={`제휴 ${count(r.via_curator)}`} />
          <Stat label="확정" value={count(r.confirmed)} />
          <Stat label="방문" value={count(r.visited)} />
          <Stat label="노쇼" value={count(r.no_show)} />
          <Stat label="취소" value={count(r.cancelled)} />
          <Stat label="거절" value={count(r.declined)} />
        </div>
      </div>
      <div>
        <h2 className="text-[15px] font-semibold">날짜별 과금 횟수</h2>
        {dash.daily.length === 0 ? (
          <p className="mt-2 text-[14px] text-muted">이 기간에는 아직 없어요.</p>
        ) : (
          <div className="mt-3 flex h-32 items-end gap-1" role="img" aria-label="날짜별 과금 횟수">
            {dash.daily.map((d) => (
              <div key={d.d} className="flex flex-1 flex-col items-center gap-1" title={`${d.d}: ${d.count}회 · ${money(d.cost, dash.currency)}`}>
                <div className="w-full max-w-[24px] rounded-t bg-pin" style={{ height: `${(Number(d.count) / max) * 100}%` }} />
                <span className="text-[10px] text-muted">{d.d.slice(5)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div>
        <h2 className="text-[15px] font-semibold">리스트별 과금</h2>
        {dash.by_list.length === 0 ? (
          <p className="mt-2 text-[14px] text-muted">아직 없어요.</p>
        ) : (
          <table className="mt-2 w-full text-left text-[14px]">
            <thead className="border-b border-rule text-[12px] text-muted">
              <tr><th className="py-2">리스트</th><th>횟수</th><th>광고비</th></tr>
            </thead>
            <tbody>
              {dash.by_list.map((l) => (
                <tr key={`${l.handle}/${l.slug}`} className="border-b border-rule">
                  <td className="py-2"><Link href={`/@${l.handle}/${l.slug}`} className="font-semibold">{l.list}</Link> <span className="text-[12px] text-muted">@{l.handle}</span></td>
                  <td className="tabular-nums">{count(l.count)}</td>
                  <td className="tabular-nums">{money(l.cost, dash.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

type Topup = { id: string; amount: number; currency: string; method: string; provider: string; pay_amount: number | null; pay_currency: string | null; status: string; created_at: string; paid_at: string | null };

function Billing({ b, dash, reload }: { b: Business; dash: Dash; reload: () => void }) {
  const { supabase } = useAuthed("/biz/place");
  const [amount, setAmount] = useState("");
  const [country, setCountry] = useState(() => {
    try {
      return localStorage.getItem("pw-pay-country") ?? "";
    } catch {
      return "";
    }
  });
  const [ready, setReady] = useState<boolean | null>(null);
  const [rows, setRows] = useState<Topup[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const { data } = await supabase.from("biz_topups").select("*").eq("business_id", b.id).order("created_at", { ascending: false });
    setRows((data as Topup[]) ?? []);
  }, [supabase, b.id]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    fetch("/api/pay/config").then((r) => r.json()).then((c) => setReady(!!c.stripe)).catch(() => setReady(false));
    const paid = new URLSearchParams(window.location.search).get("paid");
    if (paid) setMsg(paid === "stripe" ? "결제됐어요. 잔액에 반영되기까지 몇 초 걸릴 수 있어요." : paid === "cancel" ? "결제를 취소했어요." : "결제가 완료되지 않았어요. 다시 시도하세요.");
  }, [load]);

  const v = Number(amount);
  function pickCountry(c: string) {
    setCountry(c);
    try {
      localStorage.setItem("pw-pay-country", c);
    } catch {
      /* 저장 못 해도 괜찮다 */
    }
  }

  async function bank(e: React.FormEvent) {
    e.preventDefault();
    if (!(v > 0)) return setMsg("금액을 넣으세요.");
    const { error } = await supabase.from("biz_topups").insert({ business_id: b.id, amount: v, currency: dash.currency, method: "bank", provider: "bank", country: country || null });
    setMsg(error ? "요청하지 못했어요." : "충전을 요청했어요. 운영자가 입금 방법을 안내하고, 입금이 확인되면 잔액에 들어가요.");
    setAmount("");
    load();
    reload();
  }

  async function card() {
    if (!(v > 0)) return setMsg("금액을 넣으세요.");
    if (!country) return setMsg("가게가 있는 나라를 먼저 고르세요.");
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/pay/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId: b.id, amount: v, country }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => null) : null;
    if (!res?.ok || !data?.url) {
      setBusy(false);
      return setMsg(data?.error === "provider_not_ready" ? "카드 결제가 아직 준비되지 않았어요. 계좌 입금으로 충전해 주세요." : "결제를 시작하지 못했어요.");
    }
    window.location.href = data.url;
  }

  return (
    <section className="grid gap-5">
      <form onSubmit={bank} className="grid max-w-[520px] gap-3 rounded-xl border border-rule p-4">
        <h2 className="text-[16px] font-semibold">광고비 충전</h2>
        <p className="text-[13px] text-muted">
          미리 충전한 금액에서 과금돼요. 잔액이 조건 금액보다 적어지면 과금이 멈추고, 큐레이터가 ‘광고비 지급될 때만 공개’로 담은 리스트에서는 우리 가게가 숨겨져요.
        </p>
        <label className="grid gap-1 text-[13px] font-semibold">
          가게가 있는 나라
          <select value={country} onChange={(e) => pickCountry(e.target.value)} className="field">
            <option value="">고르세요</option>
            {PAY_COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>
          {country && <span className="font-normal text-muted">{payNote(country, dash.currency)}</span>}
        </label>
        <label className="grid gap-1 text-[13px] font-semibold">
          충전 금액({dash.currency})
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className="field" placeholder="예: 100" />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={card} disabled={busy || !ready} className="btn-primary disabled:opacity-40">
            {busy ? "결제 여는 중" : "카드로 결제(Stripe)"}
          </button>
          <button className="btn-quiet">계좌 입금으로 충전 요청</button>
        </div>
        {ready === false && <p className="text-[12px] text-muted">카드 결제는 연결 준비 중이에요. 지금은 계좌 입금으로 충전해 주세요.</p>}
        <Msg text={msg} />
      </form>
      <div>
        <h2 className="text-[15px] font-semibold">충전 기록</h2>
        {rows.length === 0 ? (
          <p className="mt-2 text-[14px] text-muted">아직 없어요.</p>
        ) : (
          <ul className="mt-2 divide-y divide-rule text-[14px]">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap gap-2 py-2">
                <span className="tabular-nums">{new Date(r.created_at).toLocaleDateString("ko-KR")}</span>
                <b className="tabular-nums">{money(r.amount, r.currency)}</b>
                <span className={r.status === "paid" ? "text-teal" : r.status === "cancelled" ? "text-muted line-through" : "text-pin"}>
                  {r.status === "paid" ? (r.provider === "bank" ? "입금 확인" : "결제 완료") : r.status === "cancelled" ? "취소" : r.provider === "bank" ? "입금 대기" : "결제 미완료"}
                </span>
                <span className="text-[12px] text-muted">
                  {r.provider === "bank" ? "계좌 입금" : "카드"}
                  {r.pay_currency && r.pay_currency !== r.currency && r.pay_amount ? ` · ${money(r.pay_amount, r.pay_currency)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

// ── 예약 문의 관리(대화 포함) ─────────────────────────
type Resv = {
  id: string; user_id: string | null; name: string; phone: string; visit_date: string; visit_time: string | null; party_size: number; note: string | null;
  status: "new" | "confirmed" | "declined" | "visited" | "no_show" | "cancelled"; reply: string | null; created_at: string; cancelled_by: string | null;
  curator_id: string | null; attachment_id: string | null; list: { title: string } | null;
};
const RS: Record<Resv["status"], string> = { new: "새 문의", confirmed: "확정", declined: "거절", visited: "방문 완료", no_show: "노쇼", cancelled: "취소" };

function Reservations({ b, onChanged }: { b: Business; onChanged: () => void }) {
  const { user, supabase } = useAuthed("/biz/place");
  const [rows, setRows] = useState<Resv[] | null>(null);
  const [filter, setFilter] = useState<"open" | "all">("open");
  const [open, setOpen] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const load = useCallback(async () => {
    let q = supabase
      .from("reservations")
      .select("id, user_id, name, phone, visit_date, visit_time, party_size, note, status, reply, created_at, cancelled_by, curator_id, attachment_id, list:lists(title)")
      .eq("business_id", b.id)
      .order("visit_date", { ascending: true })
      .limit(200);
    if (filter === "open") q = q.in("status", ["new", "confirmed"]);
    const { data } = await q;
    setRows((data as unknown as Resv[]) ?? []);
  }, [supabase, b.id, filter]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function act(r: Resv, status: Resv["status"], reply: string) {
    const { error } = await supabase.rpc("set_reservation_status", { p_id: r.id, p_status: status, p_reply: reply });
    if (error) {
      setMsg(error.message.includes("insufficient")
        ? "광고비 잔액이 예약 보상 금액보다 적어 확정할 수 없어요(큐레이터 제휴로 들어온 문의). ‘광고비’ 탭에서 충전한 뒤 확정해 주세요."
        : "바꾸지 못했어요.");
    } else setMsg(`${r.name}님 문의: ${RS[status]}`);
    load();
    onChanged();
  }

  if (!rows || !user) return <p className="text-muted">불러오는 중…</p>;
  return (
    <section className="grid gap-4">
      {!b.reservations_enabled && (
        <p className="rounded-lg bg-surface px-3 py-2 text-[13px]">예약 문의가 꺼져 있어요. ‘예약 설정’ 탭에서 켜면 장소 카드에 ‘예약 문의’ 버튼이 생겨요.</p>
      )}
      <p className="text-[13px] text-muted">
        장소 카드의 ‘예약 문의’로 들어온 요청이에요. 확정·거절 전에도 ‘대화’로 손님과 메시지를 주고받을 수 있어요. 큐레이터 제휴로 들어온 문의는 확정할 때 보상이
        나가고(잔액 필요), 확정 뒤 노쇼·취소로 바꾸면 되돌려 받아요.
      </p>
      <div className="flex gap-2">
        <button type="button" onClick={() => setFilter("open")} className={`${filter === "open" ? "btn-primary" : "btn-quiet"} !py-1 !text-[13px]`}>처리할 것</button>
        <button type="button" onClick={() => setFilter("all")} className={`${filter === "all" ? "btn-primary" : "btn-quiet"} !py-1 !text-[13px]`}>전체</button>
      </div>
      <Msg text={msg} />
      {rows.length === 0 ? (
        <p className="text-[14px] text-muted">{filter === "open" ? "처리할 문의가 없어요." : "아직 문의가 없어요."}</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {rows.map((r) => (
            <li key={r.id} className={`rounded-xl border p-4 ${r.status === "new" ? "border-pin" : "border-rule"}`}>
              <p className="flex items-center gap-2">
                <b className="text-[16px]">{r.visit_date.slice(5).replace("-", "/")} {r.visit_time ?? ""}</b>
                <span className="text-[14px]">· {r.party_size}명</span>
                <span className={`ml-auto rounded-full px-2 py-0.5 text-[12px] ${r.status === "new" ? "bg-pin text-white" : "bg-surface text-muted"}`}>
                  {RS[r.status]}{r.status === "cancelled" && r.cancelled_by === "guest" ? "(손님)" : ""}
                </span>
              </p>
              <p className="mt-1 text-[14px]">
                {r.name} · <a href={`tel:${r.phone}`} className="text-teal underline">{r.phone}</a>
              </p>
              {r.note && <p className="mt-1 text-[13px] text-ink/80">요청: {r.note}</p>}
              {r.reply && <p className="mt-1 text-[13px] text-muted">내 답: {r.reply}</p>}
              <p className="mt-1 text-[12px] text-muted">
                {r.list ? `‘${r.list.title}’에서` : "장소 카드에서"} · {new Date(r.created_at).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" })}
                {r.attachment_id ? " · 큐레이터 제휴(확정 시 보상)" : ""}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => setOpen(open === r.id ? null : r.id)} className="btn-quiet !px-3 !py-1 !text-[13px]">
                  {open === r.id ? "대화 닫기" : "대화"}
                </button>
                {r.status === "new" && (
                  <>
                    <ConfirmButton label="확정" className="btn-primary !px-3 !py-1 !text-[13px]" question={`${r.name}님 ${r.visit_date.slice(5).replace("-", "/")} ${r.visit_time ?? ""} ${r.party_size}명 예약을 확정할까요?`} withNote="손님에게 보낼 말(선택). 예: 창가 자리로 준비할게요" confirmLabel="확정" onConfirm={(t) => act(r, "confirmed", t)} />
                    <ConfirmButton label="거절" className="btn-quiet !px-3 !py-1 !text-[13px]" question="이 문의를 거절할까요?" withNote="거절 사유(손님에게 보여요)" confirmLabel="거절" onConfirm={(t) => act(r, "declined", t)} />
                  </>
                )}
                {r.status === "confirmed" && (
                  <>
                    <ConfirmButton label="방문함" className="btn-quiet !px-3 !py-1 !text-[13px]" question="손님이 방문했나요?" confirmLabel="방문함" onConfirm={(t) => act(r, "visited", t)} />
                    <ConfirmButton label="노쇼" className="btn-quiet !px-3 !py-1 !text-[13px]" question="노쇼로 기록할까요? 큐레이터 보상은 되돌려져요." withNote="사유(선택, 손님에게 보여요)" confirmLabel="노쇼로 기록" onConfirm={(t) => act(r, "no_show", t)} />
                    <ConfirmButton label="취소" className="btn-quiet !px-3 !py-1 !text-[13px]" question="가게 사정으로 취소할까요? 큐레이터 보상은 되돌려져요." withNote="사유(손님에게 보여요)" confirmLabel="취소하기" onConfirm={(t) => act(r, "cancelled", t)} />
                  </>
                )}
              </div>
              {open === r.id && <ReservationThread reservationId={r.id} meId={user.id} otherLabel={`${r.name}님`} />}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function payNote(country: string, currency: string) {
  if (country === "KR") return `Stripe로 원화 결제: 국내 카드·네이버페이·삼성페이·페이코 사용 가능(충전액 ${currency} 기준, 결제일 환율로 원화 표시)`;
  return `Stripe 카드 결제(${currency})`;
}
