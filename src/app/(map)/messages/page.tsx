import type { Metadata } from "next";
import { Inbox } from "@/components/Messages";

export const metadata: Metadata = { title: "메시지" };

export default function Page() {
  return <Inbox />;
}
