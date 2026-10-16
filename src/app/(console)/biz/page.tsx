import type { Metadata } from "next";
import { ConsoleHome } from "@/components/console/ui";

export const metadata: Metadata = { title: "상업 이용자용 콘솔" };

// 어떤 상업 이용자인지 고르면 각자의 콘솔로 보낸다
export default function Page() {
  return <ConsoleHome />;
}
