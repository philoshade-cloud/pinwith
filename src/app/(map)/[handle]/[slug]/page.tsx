import type { Metadata } from "next";
import { Suspense } from "react";
import { PanelLoading } from "@/components/shell/Panel";
import { notFound, permanentRedirect } from "next/navigation";
import { ListExplorer } from "@/components/ListExplorer";
import { findMovedOfficialList, getCuratedList } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/env";
import { getListPreview } from "@/lib/public";
import { SITE, clip, ldJson, placesLine, seoLang } from "@/lib/seo";

// /@handle/slug — 큐레이터의 리스트 화면. 로그인 없이도 공개·링크 공개 리스트를 그대로 본다.
// 링크를 붙였을 때 보이는 제목·설명(카톡·인스타·메신저 미리보기)
export async function generateMetadata({ params }: PageProps<"/[handle]/[slug]">): Promise<Metadata> {
  const { handle, slug } = await params;
  const p = await getListPreview(handle, slug);
  if (!p) return { title: "PinWith" };
  const title = `${p.title} · ${p.curatorName}`;
  const description = clip(p.description || placesLine(seoLang(p.lang), p.count));
  const url = `/@${p.handle}/${encodeURIComponent(decodeURIComponent(slug))}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    // 링크로만 공유한 리스트는 검색에 나오지 않게
    robots: p.indexable ? undefined : { index: false, follow: false },
    openGraph: { title, description, type: "website", url, locale: p.lang.replace("-", "_") },
    twitter: { card: "summary_large_image", title, description },
  };
}

// 검색엔진이 읽는 구조화 데이터: 장소 목록(ItemList of Place)
async function ListLd({ handle, slug }: { handle: string; slug: string }) {
  const p = await getListPreview(handle, slug);
  if (!p || !p.indexable) return null;
  const url = `${SITE}/@${p.handle}/${encodeURIComponent(decodeURIComponent(slug))}`;
  const data = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: p.title,
    description: p.description || undefined,
    url,
    inLanguage: p.lang,
    numberOfItems: p.places.length,
    author: { "@type": "Person", name: p.curatorName, url: `${SITE}/@${p.handle}` },
    itemListElement: p.places.slice(0, 100).map((x, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Place",
        name: x.name,
        ...(x.lat != null && x.lng != null ? { geo: { "@type": "GeoCoordinates", latitude: x.lat, longitude: x.lng } } : {}),
      },
    })),
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(data) }} />;
}

export default function ListPage({ params }: PageProps<"/[handle]/[slug]">) {
  return (
    <Suspense fallback={<PanelLoading />}>
      <ListContent params={params} />
    </Suspense>
  );
}

async function ListContent({ params }: { params: PageProps<"/[handle]/[slug]">["params"] }) {
  const { handle, slug } = await params;
  if (!isSupabaseConfigured()) notFound();
  const list = await getCuratedList(handle, slug);
  if (!list) {
    const moved = await findMovedOfficialList(handle, slug);
    if (moved) permanentRedirect(moved);
    notFound();
  }
  return (
    <>
      <ListLd handle={handle} slug={slug} />
      <ListExplorer list={list} />
    </>
  );
}
