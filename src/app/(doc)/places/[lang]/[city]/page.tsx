import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { cityName, findCity } from "@/lib/cities";
import { isLang, isRtl, type Lang } from "@/lib/i18n/core";
import { landingCities, landingCity, type LandingList } from "@/lib/landing";
import { lt } from "@/lib/landingText";
import { LangLinks } from "@/components/LangLinks";
import { PinThumb } from "@/components/PinThumb";
import { CityTiles } from "@/components/CityTiles";
import { SITE, clip, langAlternates, ldJson, placesLine } from "@/lib/seo";

// /places/<언어>/<도시> — 검색엔진용 도시 소개: 그 도시의 공개 리스트를 그 언어로 먼저, 다른 언어 리스트는 아래에.
export async function generateMetadata({ params }: PageProps<"/places/[lang]/[city]">): Promise<Metadata> {
  const { lang, city: slug } = await params;
  if (!isLang(lang)) return { title: "PinWith" };
  const d = await landingCity(slug, lang);
  if (!d) return { title: "PinWith", robots: { index: false } };
  const name = cityName(d.city, lang);
  const title = lt(lang, "title", { city: name });
  const description = clip(lt(lang, "intro", { city: name, n: d.mine.length + d.others.length }));
  const url = `/places/${lang}/${slug}`;
  return {
    title,
    description,
    alternates: { canonical: url, languages: langAlternates((l) => `/places/${l}/${slug}`, d.langs, `/places/en/${slug}`) },
    openGraph: { title, description, type: "website", url, locale: lang.replace("-", "_") },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default function CityPage({ params }: PageProps<"/places/[lang]/[city]">) {
  return (
    <Suspense fallback={null}>
      <CityContent params={params} />
    </Suspense>
  );
}

async function CityContent({ params }: { params: PageProps<"/places/[lang]/[city]">["params"] }) {
  const { lang, city: slug } = await params;
  if (!isLang(lang)) notFound();
  const d = await landingCity(slug, lang);
  if (!d) notFound();
  const name = cityName(d.city, lang);
  const total = d.mine.length + d.others.length;
  const cities = (await landingCities()).filter((c) => c.slug !== slug && c.langs.includes(lang));
  const ld = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: lt(lang, "title", { city: name }),
    url: `${SITE}/places/${lang}/${slug}`,
    inLanguage: lang,
    about: { "@type": "City", name, geo: { "@type": "GeoCoordinates", latitude: d.city.lat, longitude: d.city.lng } },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: total,
      itemListElement: [...d.mine, ...d.others].map((l, i) => ({ "@type": "ListItem", position: i + 1, url: `${SITE}${l.path}`, name: l.title })),
    },
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: lt(lang, "indexTitle"), item: `${SITE}/places/${lang}` },
        { "@type": "ListItem", position: 2, name, item: `${SITE}/places/${lang}/${slug}` },
      ],
    },
  };
  return (
    <div lang={lang} dir={isRtl(lang) ? "rtl" : "ltr"}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(ld) }} />
      <p className="note">
        <Link href={`/places/${lang}`}>{lt(lang, "indexTitle")}</Link> › {name}
      </p>
      <h1>{lt(lang, "title", { city: name })}</h1>
      <p>{lt(lang, "intro", { city: name, n: total })}</p>
      <LangLinks langs={d.langs} current={lang} href={(l) => `/places/${l}/${slug}`} />

      {d.mine.map((l) => <ListCard key={l.path} l={l} lang={lang} />)}
      {d.others.length > 0 && (
        <>
          {d.mine.length > 0 && <h2>{lt(lang, "others")}</h2>}
          {d.others.map((l) => <ListCard key={l.path} l={l} lang={lang} />)}
        </>
      )}

      <p className="mt-8">
        <Link href="/" className="font-semibold">{lt(lang, "cta")} →</Link>
      </p>
      {cities.length > 0 && (
        <>
          <h2>{lt(lang, "otherCities")}</h2>
          <CityTiles items={cities.map((c) => ({ href: `/places/${lang}/${c.slug}`, name: cityName(findCity(c.slug)!, lang), sub: lt(lang, "lists", { n: c.count }) }))} />
        </>
      )}
    </div>
  );
}

function ListCard({ l, lang }: { l: LandingList; lang: Lang }) {
  // 카드 전체가 리스트 화면으로 가는 버튼(눌러서 지도로 열린다는 게 보이게)
  return (
    <Link
      href={l.path}
      className="group mt-4 flex items-start gap-4 rounded-2xl border border-rule bg-white p-4 no-underline shadow-sm transition hover:-translate-y-0.5 hover:border-teal hover:shadow-md"
    >
      <PinThumb pins={l.pins} course={l.course} />
      <span className="min-w-0 flex-1">
        <span lang={l.lang} dir="auto" className="block text-[17px] font-semibold leading-snug text-ink group-hover:text-teal">{l.title}</span>
        <span className="mt-1 block text-[13px] text-muted">
          <bdi>@{l.handle}</bdi> · {placesLine(lang, l.count).replace(" · PinWith", "")}
        </span>
        {l.description && <span lang={l.lang} dir="auto" className="mt-1.5 line-clamp-2 block text-[14px] leading-relaxed text-ink/80">{l.description}</span>}
        {l.places.length > 0 && (
          <span lang={l.lang} dir="auto" className="mt-1.5 line-clamp-2 block text-[13px] text-ink/70">📍 {l.places.slice(0, 8).join(" · ")}{l.places.length > 8 ? " …" : ""}</span>
        )}
        {l.themes.length > 0 && (
          <span className="mt-2 flex flex-wrap gap-1">
            {l.themes.map((t) => (
              <span key={t} lang={l.lang} className="rounded-full bg-surface px-2 py-0.5 text-[12px] text-teal">#{t}</span>
            ))}
          </span>
        )}
        <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-teal px-3 py-1.5 text-[13px] font-semibold text-white">
          🗺️ {lt(lang, "openMap")} <span aria-hidden className="inline-block rtl:rotate-180">→</span>
        </span>
      </span>
    </Link>
  );
}
