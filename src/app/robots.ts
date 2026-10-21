import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://pinwith.me";

// AI 학습·대량 수집용 로봇: 사이트 전체를 막는다. 지키는 것은 이름을 밝히는 큰 회사 로봇뿐이다
// (이름을 숨기는 수집기는 Vercel 방화벽의 봇 차단으로 막는다). 검색(Googlebot·Bingbot)과
// 광고 심사(Mediapartners-Google)는 막지 않는다. Google-Extended는 검색이 아니라 구글 AI 학습용이라 막아도 검색 노출에는 영향이 없다.
const AI_BOTS = [
  "GPTBot", "ChatGPT-User", "OAI-SearchBot", "ClaudeBot", "Claude-Web", "anthropic-ai", "Google-Extended", "GoogleOther",
  "CCBot", "PerplexityBot", "Perplexity-User", "Bytespider", "Amazonbot", "Applebot-Extended", "meta-externalagent",
  "FacebookBot", "cohere-ai", "cohere-training-data-crawler", "Diffbot", "ImagesiftBot", "Omgilibot", "Omgili", "YouBot",
  "AI2Bot", "Ai2Bot-Dolma", "PetalBot", "Timpibot", "Webzio-Extended", "DuckAssistBot", "MistralAI-User", "SemrushBot-OCOB",
];

// 로봇 안내: 공개 화면은 열고, 개인·운영 화면은 막는다
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/api/", "/admin", "/me", "/biz", "/auth/", "/login", "/search"] },
      { userAgent: AI_BOTS, disallow: "/" },
    ],
    sitemap: `${SITE}/sitemap.xml`,
  };
}
