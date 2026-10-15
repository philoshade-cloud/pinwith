"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

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
    return new Intl.NumberFormat("ko-KR", { style: "currency", currency, maximumFractionDigits: currency === "KRW" ? 0 : 2 }).format(n);
  } catch {
    return `${n.toLocaleString("ko-KR")} ${currency}`;
  }
}
export const count = (v: number | string | null | undefined) => Number(v ?? 0).toLocaleString("ko-KR");

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string }[]; value: T; onChange: (t: T) => void }) {
  return (
    <nav className="-mx-1 flex gap-2 overflow-x-auto border-b border-rule px-1 pb-3">
      {tabs.map((t) => (
        <button key={t.id} type="button" onClick={() => onChange(t.id)} className={`shrink-0 ${value === t.id ? "btn-primary" : "btn-quiet"} !py-1.5`}>
          {t.label}
        </button>
      ))}
    </nav>
  );
}

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-rule p-4">
      <p className="text-[12px] text-muted">{label}</p>
      <p className="mt-1 text-[22px] font-semibold tabular-nums text-ink">{value}</p>
      {hint && <p className="mt-1 text-[12px] text-muted">{hint}</p>}
    </div>
  );
}

export function Period({ value, onChange }: { value: number; onChange: (d: number) => void }) {
  return (
    <div className="flex gap-1" role="group" aria-label="기간">
      {[7, 30, 90].map((d) => (
        <button key={d} type="button" onClick={() => onChange(d)} className={`${value === d ? "btn-primary" : "btn-quiet"} !px-3 !py-1 !text-[13px]`}>
          {d}일
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
