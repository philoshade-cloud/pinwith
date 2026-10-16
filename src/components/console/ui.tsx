"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { ConfirmButton } from "../ConfirmButton";
import { Logo } from "../Logo";
import { currentLocale, useT } from "@/lib/i18n/client";

export { ConfirmButton };

// 로그인한 사람만: 아니면 로그인 화면으로 보내고 돌아오게 한다
export function useAuthed(next: string) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.replace(`/login?next=${encodeURIComponent(next)}`);
      setUser(data.user ?? null);
    });
  }, [supabase, router, next]);
  return { user, supabase };
}

export function money(v: number | string | null | undefined, currency = "USD") {
  const n = Number(v ?? 0);
  try {
    return new Intl.NumberFormat(currentLocale(), { style: "currency", currency, maximumFractionDigits: currency === "KRW" ? 0 : 2 }).format(n);
  } catch {
    return `${n.toLocaleString(currentLocale())} ${currency}`;
  }
}
export const count = (v: number | string | null | undefined) => Number(v ?? 0).toLocaleString(currentLocale());

// 탭 이름은 한국어 상수를 그대로 받아 여기서 번역한다
export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string }[]; value: T; onChange: (t: T) => void }) {
  const t = useT();
  return (
    <nav className="-mx-1 flex gap-2 overflow-x-auto border-b border-rule px-1 pb-3">
      {tabs.map((tab) => (
        <button key={tab.id} type="button" onClick={() => onChange(tab.id)} className={`shrink-0 ${value === tab.id ? "btn-primary" : "btn-quiet"} !py-1.5`}>
          {t(tab.label)}
        </button>
      ))}
    </nav>
  );
}

// 대시보드 숫자 상자. onClick을 주면 눌러서 자세히 보기(상세 화면)로 간다.
export function Stat({ label, value, hint, onClick }: { label: string; value: string; hint?: string; onClick?: () => void }) {
  const t = useT();
  const body = (
    <>
      <p className="text-[12px] text-muted">{label}</p>
      <p className="mt-1 text-[22px] font-semibold tabular-nums text-ink">{value}</p>
      {hint && <p className="mt-1 text-[12px] text-muted">{hint}</p>}
      {onClick && <p className="mt-2 text-[12px] font-semibold text-teal">{t("자세히 보기 ›")}</p>}
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className="rounded-xl border border-rule p-4 text-left transition hover:border-teal hover:bg-surface/50">
      {body}
    </button>
  ) : (
    <div className="rounded-xl border border-rule p-4">{body}</div>
  );
}

// 상세 화면 위쪽: 뒤로(대시보드로) + 제목. 브라우저 뒤로 가기로도 돌아간다.
export function DetailHeader({ title, onBack }: { title: string; onBack: () => void }) {
  const t = useT();
  return (
    <div className="flex items-center gap-3">
      <button type="button" onClick={onBack} className="btn-quiet !px-3 !py-1.5">{t("← 대시보드")}</button>
      <h2 className="text-[20px] font-semibold text-ink">{title}</h2>
    </div>
  );
}

// 콘솔 화면 상태를 주소(?tab=…&detail=…)에 담는다: 상세 화면은 기록을 남겨(push) 뒤로 가기가 되게 한다.
export function useConsoleNav<T extends string>(defaultTab: T) {
  const router = useRouter();
  const q = useSearchParams();
  const tab = (q.get("tab") as T | null) ?? defaultTab;
  const detail = q.get("detail");
  const go = (next: { tab?: string; detail?: string | null }, push: boolean) => {
    const p = new URLSearchParams(q.toString());
    if (next.tab !== undefined) p.set("tab", next.tab);
    if (next.detail === null) p.delete("detail");
    else if (next.detail !== undefined) p.set("detail", next.detail);
    p.delete("paid");
    const url = `${window.location.pathname}?${p.toString()}`;
    if (push) router.push(url, { scroll: true });
    else router.replace(url, { scroll: false });
  };
  return {
    tab,
    detail,
    setTab: (t: T) => go({ tab: t, detail: null }, false),
    open: (d: string) => go({ detail: d }, true),
    back: () => (window.history.length > 1 ? router.back() : go({ detail: null }, false)),
  };
}

export function Period({ value, onChange }: { value: number; onChange: (d: number) => void }) {
  const t = useT();
  return (
    <div className="flex gap-1" role="group" aria-label={t("기간")}>
      {[7, 30, 90].map((d) => (
        <button key={d} type="button" onClick={() => onChange(d)} className={`${value === d ? "btn-primary" : "btn-quiet"} !px-3 !py-1 !text-[13px]`}>
          {t("{n}일", { n: d })}
        </button>
      ))}
    </div>
  );
}

export const MODEL: Record<string, { label: string; desc: string }> = {
  click: { label: "길찾기·지도 열기 1회당", desc: "리스트에서 이 가게의 길찾기나 구글·네이버·카카오 지도 열기를 누를 때" },
  visit: { label: "가게 근처에서 누를 때 1회당", desc: "가게 500m 안에서 길찾기·지도 열기를 누를 때(방문 가능성이 높은 손님)" },
  reservation: { label: "예약 확정 1건당", desc: "리스트의 장소 카드에서 ‘예약 문의’로 들어온 문의를 가게가 확정할 때" },
};

export function Msg({ text }: { text: string }) {
  return text ? <p role="status" className="text-[14px] text-teal">{text}</p> : null;
}

// 이의 제기: 과금·되돌림·노쇼 기록이 이상할 때 운영자에게 판단을 맡긴다
export function DisputeButton({ businessId, chargeId, reservationId, label, onDone }: {
  businessId: string; chargeId?: number; reservationId?: string; label?: string; onDone?: (msg: string) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const t = useT();
  return (
    <ConfirmButton
      label={label ?? t("이의 제기")}
      className="text-[12px] text-muted underline"
      question={t("운영자에게 이의를 낼까요? 어떤 점이 이상한지 적어 주세요(5자 이상). 운영자가 양쪽 기록을 보고 판단해 결과를 알려 드려요.")}
      withNote={t("예: 손님이 실제로 방문했다고 해요 / 같은 손님이 하루에 여러 번 눌렀어요")}
      confirmLabel={t("이의 보내기")}
      onConfirm={async (note) => {
        const { error } = await supabase.rpc("file_dispute", { p_business: businessId, p_charge: chargeId ?? null, p_reservation: reservationId ?? null, p_reason: note });
        onDone?.(error ? (error.message.includes("short") ? t("이유를 5자 이상 적어 주세요.") : error.message.includes("too many") ? t("처리 중인 이의가 너무 많아요.") : t("보내지 못했어요.")) : t("이의를 보냈어요. 운영자가 확인하고 알려 드려요."));
      }}
    />
  );
}

// 서버 화면(콘솔 레이아웃·첫 화면) 안에서 번역된 문구를 그리는 조각들
export function ConsoleTopBar() {
  const t = useT();
  return (
    <div className="flex items-center gap-3">
      <Link href="/" aria-label={t("PinWith 지도로")}>
        <Logo size={28} />
      </Link>
      <Link href="/biz" className="ml-auto text-[13px] text-muted underline">{t("콘솔 처음")}</Link>
      <Link href="/" className="text-[13px] text-muted underline">{t("지도로")}</Link>
    </div>
  );
}

export function ConsoleLoading() {
  const t = useT();
  return <p className="text-muted">{t("불러오는 중…")}</p>;
}

export function ConsoleHome() {
  const t = useT();
  return (
    <section className="mx-auto max-w-[640px]">
      <h1 className="font-display text-[28px] font-semibold text-ink">{t("상업 이용자용 콘솔")}</h1>
      <p className="mt-2 text-[15px] text-muted">{t("어떤 분인지 골라 주세요.")}</p>
      <div className="mt-6 grid gap-3">
        <Link href="/biz/curator" className="block rounded-2xl border border-rule p-5 hover:border-pin">
          <span className="block text-[18px] font-semibold text-ink">{t("상업화를 원하는 큐레이터예요")}</span>
          <span className="mt-1 block text-[14px] text-muted">
            {t("내 리스트에 붙는 광고 수익, 가게 제휴로 버는 수익을 보고, 지급을 요청해요.")}
          </span>
        </Link>
        <Link href="/biz/place" className="block rounded-2xl border border-rule p-5 hover:border-pin">
          <span className="block text-[18px] font-semibold text-ink">{t("장소의 주인이에요. 손님을 모으고 싶어요")}</span>
          <span className="mt-1 block text-[14px] text-muted">
            {t("가게를 인증하고, 큐레이터에게 보상 조건을 내걸고, 성과와 광고비를 관리해요.")}
          </span>
        </Link>
      </div>
    </section>
  );
}
