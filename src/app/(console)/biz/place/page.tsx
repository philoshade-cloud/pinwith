import type { Metadata } from "next";
import { Suspense } from "react";
import { PlaceConsole } from "@/components/console/PlaceConsole";

export const metadata: Metadata = { title: "가게 콘솔", robots: { index: false } };

export default function Page() {
  return (
    <Suspense fallback={<p className="text-muted">불러오는 중…</p>}>
      <PlaceConsole />
    </Suspense>
  );
}
