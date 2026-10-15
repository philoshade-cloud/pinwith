import type { Metadata } from "next";
import { Suspense } from "react";
import { Conversation } from "@/components/Messages";
import { PanelLoading } from "@/components/shell/Panel";

export const metadata: Metadata = { title: "메시지" };

export default function Page({ params }: PageProps<"/messages/[id]">) {
  return (
    <Suspense fallback={<PanelLoading />}>
      <Thread params={params} />
    </Suspense>
  );
}

async function Thread({ params }: { params: PageProps<"/messages/[id]">["params"] }) {
  const { id } = await params;
  return <Conversation id={id} />;
}
