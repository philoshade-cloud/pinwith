import type { Metadata } from "next";
import { Suspense } from "react";
import { ReserveForm } from "@/components/Reservation";
import { PanelLoading } from "@/components/shell/Panel";

export const metadata: Metadata = { title: "예약 문의", robots: { index: false } };

export default function Page({ params }: PageProps<"/reserve/[itemId]">) {
  return (
    <Suspense fallback={<PanelLoading />}>
      <Form params={params} />
    </Suspense>
  );
}

async function Form({ params }: { params: PageProps<"/reserve/[itemId]">["params"] }) {
  const { itemId } = await params;
  return <ReserveForm itemId={itemId} />;
}
