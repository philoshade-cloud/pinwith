import type { Metadata } from "next";
import { Suspense } from "react";
import { CuratorConsole } from "@/components/console/CuratorConsole";

export const metadata: Metadata = { title: "큐레이터 콘솔", robots: { index: false } };

export default function Page() {
  return (
    <Suspense fallback={<p className="text-muted">불러오는 중…</p>}>
      <CuratorConsole />
    </Suspense>
  );
}
