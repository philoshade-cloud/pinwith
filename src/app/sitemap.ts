import type { MetadataRoute } from "next";
import { getPublicListPaths } from "@/lib/public";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://pinwith.me";

// 공개 리스트와 기본 페이지 목록(검색엔진·광고 심사용)
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lists = await getPublicListPaths();
  const handles = [...new Set(lists.map((l) => l.path.split("/")[1]))];
  return [
    { url: `${SITE}/`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE}/explore`, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE}/for-businesses`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE}/terms`, changeFrequency: "yearly", priority: 0.2 },
    ...handles.map((h) => ({ url: `${SITE}/${h}`, changeFrequency: "weekly" as const, priority: 0.5 })),
    ...lists.map((l) => ({ url: `${SITE}${encodeURI(l.path)}`, lastModified: l.updatedAt, changeFrequency: "weekly" as const, priority: 0.7 })),
  ];
}
