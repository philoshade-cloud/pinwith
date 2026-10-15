"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { loadPlacesLibrary } from "@/lib/google";
import { PAY_COUNTRIES, PROVIDER_LABEL, providerFor } from "@/lib/payments";
import { PlaceSearchBox, type FoundPlace } from "../PlaceSearch";
import { count, money, Msg, MODEL, Period, Stat, Tabs, useAuthed } from "./ui";

type Business = {
  id: string; place_id: string; place_name: string; place_address: string | null; business_name: string; reg_number: string | null;
  contact_name: string; contact_phone: string; role: "owner" | "manager"; doc_path: string | null;
  status: "pending" | "approved" | "rejected" | "suspended"; review_note: string | null; created_at: string;
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
        <Approved b={b} />
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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!place) return setMsg("어느 가게인지 먼저 고르세요.");
    if (!file && !initial?.doc_path) return setMsg("사업자등록증(또는 가게 운영을 증명하는 자료)을 올려 주세요.");
    if (!agree) return setMsg("확인 항목에 동의해 주세요.");
    setBusy(true);
    setMsg("");
    let doc = initial?.doc_path ?? null;
    if (file) {
      const ext = (file.name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5);
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("biz-docs").upload(path, file, { contentType: file.type });
      if (error) {
        setBusy(false);
        return setMsg("파일을 올리지 못했어요. 5MB 이하의 사진이나 PDF로 올려 주세요.");
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
    if (error) return setMsg("신청하지 못했어요. 칸을 확인하고 다시 시도하세요.");
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
            <div className="rounded-lg border border-rule p-1 font-normal">
              <PlaceSearchBox onPick={pickId} onResults={(_, ps) => setResults(ps)} />
            </div>
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
type Tab = "offers" | "reservations" | "stats" | "billing";
const TABS: { id: Tab; label: string }[] = [
  { id: "offers", label: "과금 모델" },
  { id: "reservations", label: "예약 문의" },
  { id: "stats", label: "성과" },
  { id: "billing", label: "광고비" },
];
type Dash = {
  currency: string; balance: number; spent_month: number; lists_with_place: number; attached_lists: number;
  organic: { taps: number; opens: number; nearby: number };
  by_model: { model: string; count: number; cost: number }[];
  by_list: { list: string; handle: string; slug: string; count: number; cost: number }[];
  daily: { d: string; count: number; cost: number }[];
};

function Approved({ b }: { b: Business }) {
  const { supabase } = useAuthed("/biz/place");
  const [tab, setTab] = useState<Tab>("offers");
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
  return (
    <div className="mt-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="광고비 잔액" value={money(dash.balance, dash.currency)} hint={dash.balance <= 0 ? "잔액이 없으면 과금이 멈춰요" : undefined} />
        <Stat label="이번 달 쓴 광고비" value={money(dash.spent_month, dash.currency)} />
        <Stat label="우리 가게를 담은 공개 리스트" value={`${count(dash.lists_with_place)}개`} />
        <Stat label="제휴를 붙인 리스트" value={`${count(dash.attached_lists)}건`} />
      </div>
      <div className="mt-6">
        <Tabs tabs={TABS} value={tab} onChange={setTab} />
      </div>
      <div className="mt-5">
        {tab === "offers" && <Offers b={b} currency={dash.currency} />}
        {tab === "reservations" && <Reservations b={b} />}
        {tab === "stats" && <Stats dash={dash} days={days} setDays={setDays} />}
        {tab === "billing" && <Billing b={b} dash={dash} reload={reload} />}
      </div>
    </div>
  );
}

const MODELS = ["click", "visit", "reservation"] as const;

type Offer = { id?: string; model: "click" | "visit" | "reservation"; rate: string; monthly_budget: string; message: string; active: boolean };

function Offers({ b, currency }: { b: Business; currency: string }) {
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
                  등록하면 우리 가게가 담긴 모든 리스트의 장소 카드에 ‘예약 문의’ 버튼이 생겨요. 문의는 ‘예약 문의’ 탭에서 확정·거절하고, 확정할 때 그 리스트에
                  이 조건을 붙인 큐레이터에게만 금액이 나가요.
                </p>
              )}
              <label className="mt-3 grid gap-1 text-[13px] font-semibold">
                {m === "reservation" ? "손님·큐레이터에게 안내(선택)" : "큐레이터에게 한마디(선택)"}
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
  return (
    <section className="grid gap-5">
      <Period value={days} onChange={setDays} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={`${days}일 광고비`} value={money(total, dash.currency)} />
        {MODELS.map((m) => {
          const x = dash.by_model.find((y) => y.model === m);
          return <Stat key={m} label={MODEL[m].label.replace(" 1회당", "")} value={`${count(x?.count)}회`} hint={money(x?.cost, dash.currency)} />;
        })}
        <Stat label="전체 리스트에서 우리 가게 탭" value={`${count(dash.organic.taps)}회`} hint={`지도 열기 ${count(dash.organic.opens)} · 근처에서 ${count(dash.organic.nearby)}`} />
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
        <h2 className="text-[15px] font-semibold">리스트별</h2>
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

function loadScript(src: string) {
  return new Promise<void>((ok, fail) => {
    if (document.querySelector(`script[src="${src}"]`)) return ok();
    const el = Object.assign(document.createElement("script"), { src, async: true });
    el.onload = () => ok();
    el.onerror = () => fail(new Error("script"));
    document.head.append(el);
  });
}

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
  const [ready, setReady] = useState<{ stripe: boolean; toss: boolean } | null>(null);
  const [krw, setKrw] = useState(1400);
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
    fetch("/api/pay/config").then((r) => r.json()).then(setReady).catch(() => setReady({ stripe: false, toss: false }));
    supabase.from("monetization_settings").select("krw_per_unit").maybeSingle().then(({ data }) => data && setKrw(Number(data.krw_per_unit)));
    // 카드 결제에서 돌아왔을 때 결과 안내
    const paid = new URLSearchParams(window.location.search).get("paid");
    if (paid) setMsg(paid === "ok" || paid === "stripe" ? "결제됐어요. 잔액에 반영되기까지 몇 초 걸릴 수 있어요." : paid === "cancel" ? "결제를 취소했어요." : "결제가 완료되지 않았어요. 카드사 안내를 확인하거나 다시 시도하세요.");
  }, [load, supabase]);

  const provider = country ? providerFor(country) : null;
  const providerReady = provider ? !!ready?.[provider] : false;
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
    if (!res?.ok || !data) {
      setBusy(false);
      return setMsg(data?.error === "provider_not_ready" ? `${PROVIDER_LABEL[provider!]} 결제가 아직 준비되지 않았어요. 계좌 입금으로 충전해 주세요.` : "결제를 시작하지 못했어요.");
    }
    if (data.provider === "stripe") {
      window.location.href = data.url;
      return;
    }
    // 토스페이먼츠 결제창
    try {
      await loadScript("https://js.tosspayments.com/v2/standard");
      const tp = (window as unknown as { TossPayments: (k: string) => { payment: (o: { customerKey: string }) => { requestPayment: (o: Record<string, unknown>) => Promise<void> } } }).TossPayments(
        process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY ?? "",
      );
      await tp.payment({ customerKey: data.customerKey }).requestPayment({
        method: "CARD",
        amount: { currency: "KRW", value: data.amount },
        orderId: data.orderId,
        orderName: data.orderName,
        successUrl: `${window.location.origin}/api/pay/toss/confirm`,
        failUrl: `${window.location.origin}/biz/place?paid=fail`,
      });
    } catch {
      setMsg("결제창을 닫았거나 열지 못했어요.");
    } finally {
      setBusy(false);
      load();
    }
  }

  return (
    <section className="grid gap-5">
      <form onSubmit={bank} className="grid max-w-[520px] gap-3 rounded-xl border border-rule p-4">
        <h2 className="text-[16px] font-semibold">광고비 충전</h2>
        <p className="text-[13px] text-muted">미리 충전한 금액에서 과금돼요. 가게가 있는 나라에 맞는 카드 결제를 연결해 드려요.</p>
        <label className="grid gap-1 text-[13px] font-semibold">
          가게가 있는 나라
          <select value={country} onChange={(e) => pickCountry(e.target.value)} className="field">
            <option value="">고르세요</option>
            {PAY_COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>
          {provider && (
            <span className="font-normal text-muted">
              카드 결제: {PROVIDER_LABEL[provider]}
              {provider === "toss" ? ` · 원화로 결제(1 ${dash.currency} = ${krw.toLocaleString("ko-KR")}원)` : ` · ${dash.currency}로 결제`}
              {ready && !providerReady && " · 준비 중"}
            </span>
          )}
        </label>
        <label className="grid gap-1 text-[13px] font-semibold">
          충전 금액({dash.currency})
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className="field" placeholder="예: 100" />
          {provider === "toss" && v > 0 && dash.currency !== "KRW" && (
            <span className="font-normal text-muted">결제 금액 약 {Math.round(v * krw).toLocaleString("ko-KR")}원</span>
          )}
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={card} disabled={busy || !providerReady} className="btn-primary disabled:opacity-40">
            {busy ? "결제 여는 중" : provider ? `${PROVIDER_LABEL[provider]}로 카드 결제` : "카드 결제"}
          </button>
          <button className="btn-quiet">계좌 입금으로 충전 요청</button>
        </div>
        {provider && ready && !providerReady && (
          <p className="text-[12px] text-muted">{PROVIDER_LABEL[provider]} 카드 결제는 연결 준비 중이에요. 지금은 계좌 입금으로 충전해 주세요.</p>
        )}
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
                  {r.provider === "bank" ? "계좌 입금" : r.provider === "toss" ? "토스페이먼츠" : "Stripe"}
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

// ── 예약 문의 관리 ─────────────────────────
type Resv = {
  id: string; name: string; phone: string; visit_date: string; visit_time: string | null; party_size: number; note: string | null;
  status: "new" | "confirmed" | "declined" | "visited" | "no_show" | "cancelled"; reply: string | null; created_at: string;
  curator_id: string | null; list: { title: string } | null;
};
const RS: Record<Resv["status"], string> = { new: "새 문의", confirmed: "확정", declined: "거절", visited: "방문 완료", no_show: "노쇼", cancelled: "취소" };

function Reservations({ b }: { b: Business }) {
  const { supabase } = useAuthed("/biz/place");
  const [rows, setRows] = useState<Resv[] | null>(null);
  const [filter, setFilter] = useState<"open" | "all">("open");
  const [msg, setMsg] = useState("");
  const load = useCallback(async () => {
    let q = supabase
      .from("reservations")
      .select("id, name, phone, visit_date, visit_time, party_size, note, status, reply, created_at, curator_id, list:lists(title)")
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

  async function act(r: Resv, status: Resv["status"]) {
    const ask = status === "confirmed" ? "손님에게 보낼 말(선택). 예: 창가 자리로 준비할게요" : status === "declined" ? "거절 사유(손님에게 보여요)" : null;
    const reply = ask ? prompt(ask, "") : "";
    if (reply === null) return;
    const { error } = await supabase.rpc("set_reservation_status", { p_id: r.id, p_status: status, p_reply: reply });
    setMsg(error ? "바꾸지 못했어요." : `${r.name}님 문의: ${RS[status]}`);
    load();
  }

  if (!rows) return <p className="text-muted">불러오는 중…</p>;
  return (
    <section className="grid gap-4">
      <p className="text-[13px] text-muted">
        PinWith 장소 카드의 ‘예약 문의’로 들어온 요청이에요. 손님에게 연락해 확인한 뒤 확정하거나 거절하세요. 확정하면 손님에게 알림이 가고, 그 리스트에 예약 제휴를 붙인
        큐레이터에게 보상이 기록돼요.
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
                <span className={`ml-auto rounded-full px-2 py-0.5 text-[12px] ${r.status === "new" ? "bg-pin text-white" : "bg-surface text-muted"}`}>{RS[r.status]}</span>
              </p>
              <p className="mt-1 text-[14px]">
                {r.name} · <a href={`tel:${r.phone}`} className="text-teal underline">{r.phone}</a>
              </p>
              {r.note && <p className="mt-1 text-[13px] text-ink/80">요청: {r.note}</p>}
              {r.reply && <p className="mt-1 text-[13px] text-muted">내 답: {r.reply}</p>}
              <p className="mt-1 text-[12px] text-muted">
                {r.list ? `‘${r.list.title}’에서` : "리스트에서"} · {new Date(r.created_at).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" })}
                {r.curator_id ? " · 큐레이터 제휴" : ""}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {r.status === "new" && (
                  <>
                    <button type="button" onClick={() => act(r, "confirmed")} className="btn-primary !px-3 !py-1 !text-[13px]">확정</button>
                    <button type="button" onClick={() => act(r, "declined")} className="btn-quiet !px-3 !py-1 !text-[13px]">거절</button>
                  </>
                )}
                {r.status === "confirmed" && (
                  <>
                    <button type="button" onClick={() => act(r, "visited")} className="btn-quiet !px-3 !py-1 !text-[13px]">방문함</button>
                    <button type="button" onClick={() => act(r, "no_show")} className="btn-quiet !px-3 !py-1 !text-[13px]">노쇼</button>
                    <button type="button" onClick={() => act(r, "cancelled")} className="btn-quiet !px-3 !py-1 !text-[13px]">취소</button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
