import type { Metadata } from "next";
import { LANG_IDS } from "@/lib/i18n/core";
import { langAlternates } from "@/lib/seo";
import { ExploreView } from "@/components/ExploreView";

export const metadata: Metadata = { title: "타인의 핀", alternates: { languages: langAlternates((l) => `/explore?lang=${l}`, LANG_IDS, "/explore") } };

export default function Page() {
  return <ExploreView />;
}
