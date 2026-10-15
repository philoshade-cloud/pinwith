import type { Metadata } from "next";
import { StatsView } from "@/components/StatsView";

export const metadata: Metadata = { title: "내 통계" };

export default function Page() {
  return <StatsView />;
}
