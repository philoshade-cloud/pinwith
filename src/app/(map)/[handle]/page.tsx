import type { Metadata } from "next";
import { Suspense } from "react";
import { PanelLoading } from "@/components/shell/Panel";
import { notFound } from "next/navigation";
import { CuratorView } from "@/components/CuratorView";
import { getCuratorPage } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/env";
import { getCuratorPreview } from "@/lib/public";

// /@handle — 큐레이터의 지도: 리스트들의 장소를 한 지도에. 주인이면 새 리스트를 만들 수 있다.
// 링크를 붙였을 때 보이는 제목·설명(카톡·인스타·메신저 미리보기)
export async function generateMetadata({ params }: PageProps<"/[handle]">): Promise<Metadata> {
  const { handle } = await params;
  const p = await getCuratorPreview(handle);
  if (!p) return { title: "PinWith" };
  const title = `${p.curatorName}의 지도`;
  const description = p.description || `장소 ${p.count}곳 · PinWith`;
  return { title, description, openGraph: { title, description, type: "website" }, twitter: { card: "summary_large_image", title, description } };
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
  return <CuratorView curator={page.curator} lists={page.lists} isOwner={page.isOwner} />;
}
