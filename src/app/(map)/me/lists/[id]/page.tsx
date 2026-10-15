import type { Metadata } from "next";
import { Suspense } from "react";
import { PanelLoading } from "@/components/shell/Panel";
import { ListEditor } from "@/components/ListEditor";

export const metadata: Metadata = { title: "리스트 편집" };

export default function Page({ params }: PageProps<"/me/lists/[id]">) {
  return (
    <Suspense fallback={<PanelLoading />}>
      <EditorRoute params={params} />
    </Suspense>
  );
}

async function EditorRoute({ params }: { params: PageProps<"/me/lists/[id]">["params"] }) {
  const { id } = await params;
  return <ListEditor listId={id} />;
}
