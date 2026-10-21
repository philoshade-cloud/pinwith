import type { Metadata } from "next";
import { Suspense } from "react";
import { PanelLoading } from "@/components/shell/Panel";
import { notFound, permanentRedirect } from "next/navigation";
import { ListExplorer } from "@/components/ListExplorer";
import { findMovedOfficialList, getCuratedList } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/env";
import { getListPreview } from "@/lib/public";

// /@handle/slug — 큐레이터의 리스트 화면. 로그인 없이도 공개·링크 공개 리스트를 그대로 본다.
// 링크를 붙였을 때 보이는 제목·설명(카톡·인스타·메신저 미리보기)
export async function generateMetadata({ params }: PageProps<"/[handle]/[slug]">): Promise<Metadata> {
  const { handle, slug } = await params;
  const p = await getListPreview(handle, slug);
  if (!p) return { title: "PinWith" };
  const title = `${p.title} · ${p.curatorName}`;
  const description = p.description || `장소 ${p.count}곳 · PinWith`;
  return { title, description, openGraph: { title, description, type: "website" }, twitter: { card: "summary_large_image", title, description } };
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
  return <ListExplorer list={list} />;
}
