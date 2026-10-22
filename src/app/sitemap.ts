import type { MetadataRoute } from "next";
import { LANG_IDS } from "@/lib/i18n/core";
import { landingCities } from "@/lib/landing";
import { getPublicListPaths } from "@/lib/public";
import { langAlternates } from "@/lib/seo";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://pinwith.me";
const abs = (m: Record<string, string>) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, `${SITE}${v}`]));

// 공개 리스트, 도시별 소개, 기본 페이지 목록(검색엔진·광고 심사용). 언어판이 있는 페이지는 언어별 주소를 함께 적는다(hreflang).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [lists, cities] = await Promise.all([getPublicListPaths(), landingCities()]);
  const handles = [...new Set(lists.map((l) => l.path.split("/")[1]))];
  const byQuery = (p: string) => abs(langAlternates((l) => `${p}?lang=${l}`, LANG_IDS, p));
  return [
    { url: `${SITE}/`, changeFrequency: "daily", priority: 1, alternates: { languages: byQuery("/") } },
    { url: `${SITE}/explore`, changeFrequency: "daily", priority: 0.8, alternates: { languages: byQuery("/explore") } },
    ...LANG_IDS.map((lang) => ({
      url: `${SITE}/places/${lang}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
      alternates: { languages: abs(langAlternates((l) => `/places/${l}`, LANG_IDS, "/places/en")) },
    })),
    ...cities.flatMap((c) =>
      c.langs.map((lang) => ({
        url: `${SITE}/places/${lang}/${c.slug}`,
        lastModified: c.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.8,
        alternates: { languages: abs(langAlternates((l) => `/places/${l}/${c.slug}`, c.langs, `/places/en/${c.slug}`)) },
      })),
    ),
    { url: `${SITE}/for-businesses`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE}/terms`, changeFrequency: "yearly", priority: 0.2 },
    ...handles.map((h) => ({ url: `${SITE}/${h}`, changeFrequency: "weekly" as const, priority: 0.5 })),
    ...lists.map((l) => ({ url: `${SITE}${encodeURI(l.path)}`, lastModified: l.updatedAt, changeFrequency: "weekly" as const, priority: 0.7 })),
  ];
}
