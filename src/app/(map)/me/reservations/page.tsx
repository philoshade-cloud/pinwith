import type { Metadata } from "next";
import { MyReservations } from "@/components/Reservation";

export const metadata: Metadata = { title: "내 예약 문의" };

export default function Page() {
  return <MyReservations />;
}
