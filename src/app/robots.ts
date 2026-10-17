import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://pinwith.me";

// 로봇 안내: 공개 화면은 열고, 개인·운영 화면은 막는다
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/admin", "/me", "/biz", "/auth/", "/login"] }],
    sitemap: `${SITE}/sitemap.xml`,
  };
}
