"use client";

import Link from "next/link";
import { Logo } from "@/components/Logo";
import { useT } from "@/lib/i18n/client";

// 문서·도시 화면 위쪽 막대: 스크롤해도 계속 보이는 '메인으로 돌아가기'
export function BackHomeBar() {
  const t = useT();
  return (
    <div className="sticky top-0 z-20 -mx-5 flex items-center justify-between gap-3 border-b border-rule bg-white/95 px-5 py-2.5 backdrop-blur">
      <Link href="/" aria-label={t("메인으로 돌아가기")}>
        <Logo size={26} />
      </Link>
      <Link href="/" className="inline-flex items-center gap-1 rounded-full bg-teal px-3.5 py-1.5 text-[13px] font-semibold text-white shadow-sm">
        <span aria-hidden className="rtl:rotate-180">←</span> {t("메인으로 돌아가기")}
      </Link>
    </div>
  );
}
