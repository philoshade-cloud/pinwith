import type { Metadata } from "next";
import { Suspense } from "react";
import { ReserveForm } from "@/components/Reservation";
import { PanelLoading } from "@/components/shell/Panel";

export const metadata: Metadata = { title: "예약 문의", robots: { index: false } };

// /reserve/[구글 장소 id]?item=[리스트 항목 id] — 리스트에서 왔으면 큐레이터 제휴로 기록된다
export default function Page({ params, searchParams }: PageProps<"/reserve/[placeId]">) {
  return (
    <Suspense fallback={<PanelLoading />}>
      <Form params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Form({ params, searchParams }: { params: PageProps<"/reserve/[placeId]">["params"]; searchParams: PageProps<"/reserve/[placeId]">["searchParams"] }) {
  const [{ placeId }, q] = await Promise.all([params, searchParams]);
  const item = typeof q.item === "string" && /^[0-9a-f-]{36}$/i.test(q.item) ? q.item : null;
  return <ReserveForm key={`${placeId}-${item}`} placeId={decodeURIComponent(placeId)} itemId={item} />;
}
