import type { Metadata } from "next";
import { ListExplorer } from "@/components/ListExplorer";
import { getSampleList } from "@/lib/sample";

export const metadata: Metadata = { title: "예시 리스트" };

export default async function DemoPage() {
  return <ListExplorer list={await getSampleList()} />;
}
