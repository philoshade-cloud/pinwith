import type { Metadata } from "next";
import { Suspense } from "react";
import { PanelLoading } from "@/components/shell/Panel";
import { notFound } from "next/navigation";
import { CuratorView } from "@/components/CuratorView";
import { getCuratorPage } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/env";
import { getCuratorPreview } from "@/lib/public";
import { SITE, clip, curatorLine, ldJson, placesLine, seoLang } from "@/lib/seo";

// /@handle — 큐레이터의 지도: 리스트들의 장소를 한 지도에. 주인이면 새 리스트를 만들 수 있다.
// 링크를 붙였을 때 보이는 제목·설명(카톡·인스타·메신저 미리보기)
export async function generateMetadata({ params }: PageProps<"/[handle]">): Promise<Metadata> {
  const { handle } = await params;
  const p = await getCuratorPreview(handle);
  if (!p) return { title: "PinWith" };
  const title = curatorLine(seoLang(p.lang), p.curatorName);
  const description = clip(p.description || placesLine(seoLang(p.lang), p.count));
  const url = `/@${p.handle}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    // 공개 리스트가 하나도 없는 빈 프로필은 검색에 내지 않는다
    robots: p.indexable ? undefined : { index: false, follow: true },
    openGraph: { title, description, type: "profile", url, locale: p.lang.replace("-", "_") },
    twitter: { card: "summary_large_image", title, description },
  };
}

// 검색엔진이 읽는 구조화 데이터: 큐레이터 프로필(ProfilePage)
async function CuratorLd({ handle }: { handle: string }) {
  const p = await getCuratorPreview(handle);
  if (!p || !p.indexable) return null;
  const data = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    url: `${SITE}/@${p.handle}`,
    inLanguage: p.lang,
    mainEntity: { "@type": "Person", name: p.curatorName, alternateName: `@${p.handle}`, description: p.description || undefined },
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(data) }} />;
}

export default function CuratorPage({ params }: PageProps<"/[handle]">) {
  return (
    <Suspense fallback={<PanelLoading />}>
      <CuratorContent params={params} />
    </Suspense>
  );
}

async function CuratorContent({ params }: { params: PageProps<"/[handle]">["params"] }) {
  const { handle } = await params;
  if (!decodeURIComponent(handle).startsWith("@") || !isSupabaseConfigured()) notFound();
  const page = await getCuratorPage(handle);
  if (!page) notFound();
  return (
    <>
      <CuratorLd handle={handle} />
      <CuratorView curator={page.curator} lists={page.lists} isOwner={page.isOwner} />
    </>
  );
}
