import type { Metadata } from "next";
import { Notifications } from "@/components/Notifications";

export const metadata: Metadata = { title: "알림" };

export default function Page() {
  return <Notifications />;
}
