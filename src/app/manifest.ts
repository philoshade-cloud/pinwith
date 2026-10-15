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
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
