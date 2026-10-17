"use client";
import { useT } from "@/lib/i18n/client";

// PinWith 운영팀 계정 표시. 운영팀이 직접 만든 리스트임을 밝힌다(일반 사용자 리스트와 구분).
export function OfficialBadge({ className = "" }: { className?: string }) {
  const t = useT();
  return (
    <span
      title={t("PinWith 운영팀이 직접 만든 리스트예요")}
      className={`inline-flex shrink-0 items-center gap-0.5 rounded-full bg-pin/10 px-1.5 py-0.5 align-middle text-[11px] font-semibold text-pin ${className}`}
    >
      <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" aria-hidden>
        <path d="M12 2l2.4 2.1 3.2-.3.9 3.1 2.8 1.6-1.1 3 1.1 3-2.8 1.6-.9 3.1-3.2-.3L12 22l-2.4-2.1-3.2.3-.9-3.1-2.8-1.6 1.1-3-1.1-3 2.8-1.6.9-3.1 3.2.3L12 2zm-1.2 13.6l5.5-5.5-1.4-1.4-4.1 4.1-2-2-1.4 1.4 3.4 3.4z" />
      </svg>
      {t("공식")}
    </span>
  );
}
