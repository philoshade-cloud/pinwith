import type { Metadata } from "next";
import { Suspense } from "react";
import { PanelLoading } from "@/components/shell/Panel";
import { SavedSearchView } from "@/components/SavedSearchView";

export const metadata: Metadata = { title: "내 핀에서 검색" };

export default function Page() {
  return (
    <Suspense fallback={<PanelLoading />}>
      <SavedSearchView />
    </Suspense>
  );
}
