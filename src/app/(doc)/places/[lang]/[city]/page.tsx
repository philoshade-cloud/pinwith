import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { cityName, findCity } from "@/lib/cities";
import { isLang, isRtl, type Lang } from "@/lib/i18n/core";
import { landingCities, landingCity, type LandingList } from "@/lib/landing";
import { lt } from "@/lib/landingText";
import { LangLinks } from "@/components/LangLinks";
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
          <ul>
            {cities.map((c) => {
              const city = findCity(c.slug)!;
              return (
                <li key={c.slug}>
                  <Link href={`/places/${lang}/${c.slug}`}>{cityName(city, lang)}</Link> · {lt(lang, "lists", { n: c.count })}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

function ListCard({ l, lang }: { l: LandingList; lang: Lang }) {
  return (
    <section lang={l.lang} dir="auto" className="mt-6 rounded-xl border border-rule p-4">
      <h3 className="!mt-0">
        <Link href={l.path}>{l.title}</Link>
      </h3>
      <p className="note !mt-1">
        @{l.handle} · {placesLine(lang, l.count).replace(" · PinWith", "")}
        {l.themes.length > 0 && ` · ${l.themes.map((t) => `#${t}`).join(" ")}`}
      </p>
      {l.description && <p>{clip(l.description, 220)}</p>}
      {l.places.length > 0 && <p className="text-[14px]">📍 {l.places.slice(0, 8).join(" · ")}{l.places.length > 8 ? " …" : ""}</p>}
      <p className="!mb-0">
        <Link href={l.path} lang={lang}>{lt(lang, "openMap")} →</Link>
      </p>
    </section>
  );
}
