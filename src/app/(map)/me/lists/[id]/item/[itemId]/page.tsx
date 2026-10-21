import type { Metadata } from "next";
import { Suspense } from "react";
import { PanelLoading } from "@/components/shell/Panel";
import { ItemEditor } from "@/components/ItemEditor";

export const metadata: Metadata = { title: "장소 편집" };

export default function Page({ params }: PageProps<"/me/lists/[id]/item/[itemId]">) {
  return (
    <Suspense fallback={<PanelLoading />}>
      <ItemRoute params={params} />
    </Suspense>
  );
}

async function ItemRoute({ params }: { params: PageProps<"/me/lists/[id]/item/[itemId]">["params"] }) {
  const { id, itemId } = await params;
  return <ItemEditor listId={id} itemId={itemId} />;
}
