import type { Metadata } from "next";
import { ListExplorer } from "@/components/ListExplorer";
import { sampleList } from "@/lib/sample";

export const metadata: Metadata = { title: "예시 리스트" };

export default function DemoPage() {
  return <ListExplorer list={sampleList} />;
}
