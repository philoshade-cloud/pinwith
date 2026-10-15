import type { Metadata } from "next";
import { CuratorConsole } from "@/components/console/CuratorConsole";

export const metadata: Metadata = { title: "큐레이터 콘솔", robots: { index: false } };

export default function Page() {
  return <CuratorConsole />;
}
