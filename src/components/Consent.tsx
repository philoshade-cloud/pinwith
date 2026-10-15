"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

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

const TEXT = {
  ko: {
    body: "PinWith는 서비스 운영에 꼭 필요한 저장 공간을 씁니다. 허용하시면 방문 통계와 (앞으로 붙을) 맞춤 광고에도 씁니다.",
    essential: "필수만",
    all: "모두 허용",
    more: "개인정보처리방침",
  },
  en: {
    body: "PinWith uses essential storage to work. If you allow, we also use it for visit statistics and (future) personalized ads.",
    essential: "Essential only",
    all: "Allow all",
    more: "Privacy policy",
  },
};

export function ConsentBanner() {
  const consent = useConsent();
  if (consent !== null) return null;
  const t = typeof navigator !== "undefined" && !navigator.language.startsWith("ko") ? TEXT.en : TEXT.ko;
  return (
    <div
      role="dialog"
      aria-label="개인정보 동의"
      className="fixed inset-x-2 bottom-[72px] z-[60] rounded-2xl bg-ink p-4 text-white shadow-xl lg:bottom-4 lg:left-auto lg:right-4 lg:w-[380px]"
    >
      <p className="text-[13px] leading-relaxed text-white/90">
        {t.body}{" "}
        <Link href="/privacy" className="underline">
          {t.more}
        </Link>
      </p>
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={() => setConsent("essential")} className="rounded-full px-3 py-1.5 text-[13px] font-semibold text-white/80 hover:text-white">
          {t.essential}
        </button>
        <button type="button" onClick={() => setConsent("all")} className="rounded-full bg-white px-4 py-1.5 text-[13px] font-semibold text-ink">
          {t.all}
        </button>
      </div>
    </div>
  );
}
