import type { Metadata } from "next";
import { ListExplorer } from "@/components/ListExplorer";
import { DemoRedirect } from "@/components/DemoRedirect";
import { getSampleList } from "@/lib/sample";

export const metadata: Metadata = { title: "예시 리스트" };

export default async function DemoPage() {
  return <DemoRedirect fallback={<ListExplorer list={await getSampleList()} />} />;
}
