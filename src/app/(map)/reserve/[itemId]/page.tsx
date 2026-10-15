import type { Metadata } from "next";
import { ReserveForm } from "@/components/Reservation";

export const metadata: Metadata = { title: "예약 문의", robots: { index: false } };

export default async function Page({ params }: PageProps<"/reserve/[itemId]">) {
  const { itemId } = await params;
  return <ReserveForm itemId={itemId} />;
}
