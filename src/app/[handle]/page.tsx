import { Suspense } from "react";
import { notFound } from "next/navigation";
import { CuratorView } from "@/components/CuratorView";
import { getCuratorPage } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/env";

// /@handle — 큐레이터의 지도: 리스트들의 장소를 한 지도에. 주인이면 새 리스트를 만들 수 있다.
export default function CuratorPage({ params }: PageProps<"/[handle]">) {
  return (
    <Suspense fallback={<div className="h-dvh bg-surface" aria-busy="true" />}>
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
