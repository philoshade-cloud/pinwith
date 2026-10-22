import type { MetadataRoute } from "next";

// 휴대폰 '홈 화면에 추가'용
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PinWith",
    short_name: "PinWith",
    description: "아는 곳을 핀으로 꽂아, 링크 하나로 건네세요.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      // 홈 화면 아이콘: 연한 지도 위 핀 두 개(10-22 사용자 선택 'C'). 바탕이 꽉 차 있어 안드로이드가 모서리를 잘라도(maskable) 핀은 남는다.
      { src: "/app-icon.svg?v=2", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-192.png?v=2", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png?v=2", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png?v=2", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
