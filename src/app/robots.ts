import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://pinwith.me";

// AI 로봇은 두 종류로 나눈다(2026-10-22 사용자 결정).
// - 허용: 사람이 AI에게 물었을 때 그 자리에서 페이지를 읽고 출처 링크를 붙이는 '검색·답변' 로봇
//   (OAI-SearchBot·ChatGPT-User, Claude-SearchBot·Claude-User, PerplexityBot·Perplexity-User, Google-Extended(Gemini 답변 근거) 등).
//   이 로봇들은 아래 * 규칙(개인·운영 화면 제외)을 따른다.
// - 차단: 모델 학습이나 대량 수집만 하는 로봇. 이름을 밝히는 회사 로봇은 대부분 지키고,
//   이름을 숨기는 수집기는 Vercel 방화벽의 봇 차단으로 막는다.
const TRAINING_BOTS = [
  "GPTBot", "ClaudeBot", "anthropic-ai", "Claude-Web", "CCBot", "Bytespider", "Applebot-Extended", "meta-externalagent",
  "FacebookBot", "GoogleOther", "cohere-ai", "cohere-training-data-crawler", "Diffbot", "ImagesiftBot", "Omgilibot", "Omgili",
  "AI2Bot", "Ai2Bot-Dolma", "Timpibot", "Webzio-Extended", "img2dataset", "Scrapy",
];

// 로봇 안내: 공개 화면은 열고, 개인·운영 화면은 막는다
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/api/", "/admin", "/me", "/biz", "/auth/", "/login", "/search"] },
      { userAgent: TRAINING_BOTS, disallow: "/" },
    ],
    sitemap: `${SITE}/sitemap.xml`,
  };
}
