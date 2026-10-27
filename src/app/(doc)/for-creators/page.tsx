import type { Metadata } from "next";
import { LANG_IDS } from "@/lib/i18n/core";
import { langAlternates } from "@/lib/seo";
import { CreatorsPage } from "@/components/CreatorsPage";

export const metadata: Metadata = {
  title: "For creators",
  description:
    "Turn the places from your travel and food videos or posts into one map your audience can open with a link, in 17 languages. Free, with stats and ways to earn.",
  alternates: { languages: langAlternates((l) => `/for-creators?lang=${l}`, LANG_IDS, "/for-creators") },
};

// 크리에이터 소개(접근대상 후속 메일·답장에 붙이는 페이지). 문구는 src/lib/creatorsText.ts(17개 언어).
export default function ForCreators() {
  return <CreatorsPage />;
}
