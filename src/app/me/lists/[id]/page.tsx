import type { Metadata } from "next";
import { Suspense } from "react";
import { ListEditor } from "@/components/ListEditor";

export const metadata: Metadata = { title: "리스트 편집" };

export default function Page({ params }: PageProps<"/me/lists/[id]">) {
  return (
    <Suspense fallback={<p className="p-8 text-muted">불러오는 중</p>}>
      <EditorRoute params={params} />
    </Suspense>
  );
}

async function EditorRoute({ params }: { params: PageProps<"/me/lists/[id]">["params"] }) {
  const { id } = await params;
  return <ListEditor listId={id} />;
}
