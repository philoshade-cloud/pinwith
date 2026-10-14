import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ListExplorer } from "@/components/ListExplorer";
import { getCuratedList } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/env";

// /@handle/slug — 큐레이터의 리스트 화면. 로그인 없이도 공개·링크 공개 리스트를 그대로 본다.
export default function ListPage({ params }: PageProps<"/[handle]/[slug]">) {
  return (
    <Suspense fallback={<div className="h-dvh bg-surface" aria-busy="true" />}>
      <ListContent params={params} />
    </Suspense>
  );
}

async function ListContent({ params }: { params: PageProps<"/[handle]/[slug]">["params"] }) {
  const { handle, slug } = await params;
  if (!isSupabaseConfigured()) notFound();
  const list = await getCuratedList(handle, slug);
  if (!list) notFound();
  return <ListExplorer list={list} />;
}
