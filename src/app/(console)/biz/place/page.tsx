import type { Metadata } from "next";
import { Suspense } from "react";
import { ConsoleLoading } from "@/components/console/ui";
import { PlaceConsole } from "@/components/console/PlaceConsole";

export const metadata: Metadata = { title: "가게 콘솔", robots: { index: false } };

export default function Page() {
  return (
    <Suspense fallback={<ConsoleLoading />}>
      <PlaceConsole />
    </Suspense>
  );
}
