import type { Metadata } from "next";
import { MyPage } from "@/components/MyPage";

export const metadata: Metadata = { title: "내 리스트" };

export default function Page() {
  return <MyPage />;
}
