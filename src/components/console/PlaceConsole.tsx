"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { loadPlacesLibrary } from "@/lib/google";
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
type Tab = "offers" | "stats" | "billing";
const TABS: { id: Tab; label: string }[] = [
  { id: "offers", label: "과금 모델" },
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
        {tab === "stats" && <Stats dash={dash} days={days} setDays={setDays} />}
        {tab === "billing" && <Billing b={b} dash={dash} reload={reload} />}
      </div>
    </div>
  );
}

type Offer = { id?: string; model: "click" | "visit"; rate: string; monthly_budget: string; message: string; active: boolean };

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
    for (const m of ["click", "visit"] as const) {
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
      <div className="grid gap-4 md:grid-cols-2">
        {(["click", "visit"] as const).map((m) => {
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
  return (
    <section className="grid gap-5">
      <Period value={days} onChange={setDays} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={`${days}일 광고비`} value={money(total, dash.currency)} />
        {(["click", "visit"] as const).map((m) => {
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

type Topup = { id: string; amount: number; currency: string; method: string; status: string; created_at: string; paid_at: string | null };

function Billing({ b, dash, reload }: { b: Business; dash: Dash; reload: () => void }) {
  const { supabase } = useAuthed("/biz/place");
  const [amount, setAmount] = useState("");
  const [rows, setRows] = useState<Topup[]>([]);
  const [msg, setMsg] = useState("");
  const load = useCallback(async () => {
    const { data } = await supabase.from("biz_topups").select("*").eq("business_id", b.id).order("created_at", { ascending: false });
    setRows((data as Topup[]) ?? []);
  }, [supabase, b.id]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function request(e: React.FormEvent) {
    e.preventDefault();
    const v = Number(amount);
    if (!(v > 0)) return setMsg("금액을 넣으세요.");
    const { error } = await supabase.from("biz_topups").insert({ business_id: b.id, amount: v, currency: dash.currency, method: "bank" });
    setMsg(error ? "요청하지 못했어요." : "충전을 요청했어요. 운영자가 입금 방법을 안내하고, 입금이 확인되면 잔액에 들어가요.");
    setAmount("");
    load();
    reload();
  }

  return (
    <section className="grid gap-5">
      <form onSubmit={request} className="grid max-w-[480px] gap-3 rounded-xl border border-rule p-4">
        <h2 className="text-[16px] font-semibold">광고비 충전</h2>
        <p className="text-[13px] text-muted">미리 충전한 금액에서 과금돼요. 지금은 계좌 입금으로 받고, 카드 결제는 곧 열려요.</p>
        <label className="grid gap-1 text-[13px] font-semibold">
          금액({dash.currency})
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className="field" placeholder="예: 100" />
        </label>
        <div className="flex gap-2">
          <button className="btn-primary">계좌 입금으로 충전 요청</button>
          <button type="button" disabled className="btn-quiet opacity-40" title="결제 서비스 연결 후 열려요">카드 결제(준비 중)</button>
        </div>
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
                  {r.status === "paid" ? "입금 확인" : r.status === "cancelled" ? "취소" : "입금 대기"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
