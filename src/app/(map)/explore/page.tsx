import type { Metadata } from "next";
import { ExploreView } from "@/components/ExploreView";

export const metadata: Metadata = { title: "타인의 핀" };

export default function Page() {
  return <ExploreView />;
}
