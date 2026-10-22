"use client";

import Link from "next/link";
import { cityName, findCity } from "@/lib/cities";
import type { Lang } from "@/lib/i18n/core";
import { useLang, useT } from "@/lib/i18n/client";

// 도시 페이지 링크의 언어: 화면 언어판이 있으면 그 언어, 없으면 영어판
export const cityHref = (slug: string, langs: readonly Lang[], ui: Lang) => `/places/${langs.includes(ui) ? ui : "en"}/${slug}`;

// 리스트 화면: '서울의 다른 리스트 12개 →'
export function CityLink({ city }: { city: { slug: string; count: number; langs: Lang[] } }) {
  const t = useT();
  const ui = useLang();
  const c = findCity(city.slug);
  const n = city.count - 1;
  if (!c || n < 1) return null;
  return (
    <p className="mt-3">
      <Link href={cityHref(city.slug, city.langs, ui)} className="text-[14px] font-semibold text-teal">
        📍 {t("{city}의 다른 리스트 {n}개", { city: cityName(c, ui), n })} →
      </Link>
    </p>
  );
}
