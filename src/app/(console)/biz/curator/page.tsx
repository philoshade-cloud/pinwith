import type { Metadata } from "next";
import { Suspense } from "react";
import { ConsoleLoading } from "@/components/console/ui";
import { CuratorConsole } from "@/components/console/CuratorConsole";

export const metadata: Metadata = { title: "큐레이터 콘솔", robots: { index: false } };

export default function Page() {
  return (
    <Suspense fallback={<ConsoleLoading />}>
      <CuratorConsole />
    </Suspense>
  );
}
