import type { Metadata } from "next";
import { Suspense } from "react";
import { NoticePanel } from "@/components/NoticeComposer";
import { PanelLoading } from "@/components/shell/Panel";

export const metadata: Metadata = { title: "공지" };

export default function Page({ params }: PageProps<"/me/lists/[id]/notice">) {
  return (
    <Suspense fallback={<PanelLoading />}>
      <Notice params={params} />
    </Suspense>
  );
}

async function Notice({ params }: { params: PageProps<"/me/lists/[id]/notice">["params"] }) {
  const { id } = await params;
  return <NoticePanel listId={id} />;
}
