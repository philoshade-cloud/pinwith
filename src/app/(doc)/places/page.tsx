import type { Metadata } from "next";
import { PlacesRedirect } from "@/components/PlacesRedirect";

export const metadata: Metadata = { title: "Map lists by city", robots: { index: false, follow: true } };

// /places — 화면 언어의 도시 목록으로 보낸다(검색엔진은 아래 링크를 따라간다)
export default function Places() {
  return <PlacesRedirect />;
}
