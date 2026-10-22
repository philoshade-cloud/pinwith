import type { Metadata } from "next";
import { ExploreView } from "@/components/ExploreView";

export const metadata: Metadata = { title: "타인의 핀", alternates: { canonical: "/explore" } };

export default function Page() {
  return <ExploreView />;
}
