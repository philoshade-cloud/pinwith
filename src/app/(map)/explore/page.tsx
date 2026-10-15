import type { Metadata } from "next";
import { ExploreView } from "@/components/ExploreView";

export const metadata: Metadata = { title: "타인의 리스트" };

export default function Page() {
  return <ExploreView />;
}
