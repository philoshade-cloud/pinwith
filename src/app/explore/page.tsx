import type { Metadata } from "next";
import { ExploreView } from "@/components/ExploreView";

export const metadata: Metadata = { title: "찾기" };

export default function Page() {
  return <ExploreView />;
}
