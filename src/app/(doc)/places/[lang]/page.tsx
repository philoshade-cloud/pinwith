import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LangLinks } from "@/components/LangLinks";
import { cityName, findCity } from "@/lib/cities";
import { LANG_IDS, isLang, isRtl } from "@/lib/i18n/core";
import { landingCities } from "@/lib/landing";
import { lt } from "@/lib/landingText";
import { langAlternates } from "@/lib/seo";

// /places/<언어> — 도시 목록. 그 언어판이 있는 도시만.
export async function generateMetadata({ params }: PageProps<"/places/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return { title: "PinWith" };
  const title = lt(lang, "indexTitle");
  const description = lt(lang, "indexIntro");
  return {
    title,
    description,
    alternates: { canonical: `/places/${lang}`, languages: langAlternates((l) => `/places/${l}`, LANG_IDS, "/places/en") },
    openGraph: { title, description, type: "website", url: `/places/${lang}`, locale: lang.replace("-", "_") },
  };
}

export default function CitiesPage({ params }: PageProps<"/places/[lang]">) {
  return (
    <Suspense fallback={null}>
      <CitiesContent params={params} />
    </Suspense>
  );
}

async function CitiesContent({ params }: { params: PageProps<"/places/[lang]">["params"] }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const all = await landingCities();
  const mine = all.filter((c) => c.langs.includes(lang));
  // 그 언어판이 없는 도시는 영어판으로
  const rest = lang === "en" ? [] : all.filter((c) => !c.langs.includes(lang));
  return (
    <div lang={lang} dir={isRtl(lang) ? "rtl" : "ltr"}>
      <h1>{lt(lang, "indexTitle")}</h1>
      <p>{lt(lang, "indexIntro")}</p>
      <LangLinks langs={LANG_IDS} current={lang} href={(l) => `/places/${l}`} />
      <ul>
        {mine.map((c) => (
          <li key={c.slug}>
            <Link href={`/places/${lang}/${c.slug}`}>{cityName(findCity(c.slug)!, lang)}</Link> · {lt(lang, "lists", { n: c.count })}
          </li>
        ))}
      </ul>
      {rest.length > 0 && (
        <>
          <h2>{lt(lang, "otherCities")}</h2>
          <ul>
            {rest.map((c) => (
              <li key={c.slug}>
                <Link href={`/places/en/${c.slug}`} hrefLang="en">{cityName(findCity(c.slug)!, lang)}</Link> · {lt(lang, "lists", { n: c.count })}
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="mt-8">
        <Link href="/" className="font-semibold">{lt(lang, "cta")} →</Link>
      </p>
    </div>
  );
}
