"use client";
import { useT } from "@/lib/i18n/client";

// 운영팀이 기능을 보여 주려고 만든 예시 리스트 표시
export function ExampleBadge({ className = "" }: { className?: string }) {
  const t = useT();
  return (
    <span
      title={t("PinWith가 기능을 보여 주려고 만든 예시 리스트예요")}
      className={`inline-flex shrink-0 items-center rounded-full bg-teal/10 px-1.5 py-0.5 align-middle text-[11px] font-semibold text-teal ${className}`}
    >
      {t("예시@@배지")}
    </span>
  );
}
