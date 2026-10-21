"use client";

import { useLang, useT } from "@/lib/i18n/client";

// 정책 문서처럼 한국어·영어 두 가지로 쓴 글: 한국어가 아니면 영어본을 보여 주고, 그 언어로 안내 한 줄
export function ByLang({ ko, en }: { ko: React.ReactNode; en: React.ReactNode }) {
  const lang = useLang();
  const t = useT();
  if (lang === "ko") return ko;
  return (
    <>
      {lang !== "en" && <p className="note" dir="auto">{t("이 문서는 영어로 제공돼요. 영어본이 기준이에요.")}</p>}
      {en}
    </>
  );
}
