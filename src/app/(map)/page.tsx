import type { Metadata } from "next";
import { Suspense } from "react";
import { CuratorView } from "@/components/CuratorView";
import { Welcome } from "@/components/Welcome";
import { PanelLoading } from "@/components/shell/Panel";
import { getMyCuratorPage } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/env";
import { getSampleList } from "@/lib/sample";

export const metadata: Metadata = { alternates: { canonical: "/" } };

// 홈 = 지도. 로그인했으면 내 모든 리스트의 핀, 아니면 예시 코스와 소개.
export default function Home() {
  return (
    <Suspense fallback={<PanelLoading />}>
      <HomeContent />
    </Suspense>
  );
}

async function HomeContent() {
  const mine = isSupabaseConfigured() ? await getMyCuratorPage() : null;
  if (mine) return <CuratorView curator={mine.curator} lists={mine.lists} isOwner defaultOpen={false} />;
  return <Welcome sample={await getSampleList()} />;
}
