import type { Metadata } from "next";
import { Suspense } from "react";
import { Receipt } from "@/components/console/Receipt";

export const metadata: Metadata = { title: "영수증", robots: { index: false } };

export default function Page({ params }: PageProps<"/biz/receipt/[id]">) {
  return (
    <Suspense fallback={null}>
      <ReceiptRoute params={params} />
    </Suspense>
  );
}

async function ReceiptRoute({ params }: { params: PageProps<"/biz/receipt/[id]">["params"] }) {
  const { id } = await params;
  return <Receipt topupId={id} />;
}
