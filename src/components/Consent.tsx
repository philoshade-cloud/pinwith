"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { useT } from "@/lib/i18n/client";

// 개인정보 동의: "all"(분석·맞춤 광고 허용) / "essential"(꼭 필요한 것만) / null(아직 안 고름)
export type ConsentChoice = "all" | "essential";
const KEY = "pw_consent";
const listeners = new Set<() => void>();

function read(): ConsentChoice | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "all" || v === "essential" ? v : null;
  } catch {
    return null;
  }
}

export function getConsent() {
  return typeof window === "undefined" ? null : read();
}

export function setConsent(v: ConsentChoice) {
  try {
    localStorage.setItem(KEY, v);
    // 동의를 거두면 기기 식별값도 지운다
    if (v === "essential") localStorage.removeItem("pw_device");
  } catch {
    /* 저장이 막힌 브라우저 */
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useConsent() {
  // 서버에서는 '아직 모름'(undefined)으로 그려서, 배너가 깜박이지 않게 한다
  return useSyncExternalStore(subscribe, read, () => undefined as ConsentChoice | null | undefined);
}

export function ConsentBanner() {
  const t = useT();
  const consent = useConsent();
  if (consent !== null) return null;
  return (
    <div
      role="dialog"
      aria-label={t("개인정보 동의")}
      className="fixed inset-x-2 bottom-[72px] z-[60] rounded-2xl bg-ink p-4 text-white shadow-xl lg:bottom-4 lg:left-auto lg:right-4 lg:w-[380px]"
    >
      <p className="text-[13px] leading-relaxed text-white/90">
        {t("PinWith는 서비스 운영에 꼭 필요한 저장 공간을 씁니다. 허용하시면 방문 통계와 (앞으로 붙을) 맞춤 광고에도 씁니다.")}{" "}
        <Link href="/privacy" className="underline">
          {t("개인정보처리방침")}
        </Link>
      </p>
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={() => setConsent("essential")} className="rounded-full px-3 py-1.5 text-[13px] font-semibold text-white/80 hover:text-white">
          {t("필수만")}
        </button>
        <button type="button" onClick={() => setConsent("all")} className="rounded-full bg-white px-4 py-1.5 text-[13px] font-semibold text-ink">
          {t("모두 허용")}
        </button>
      </div>
    </div>
  );
}
