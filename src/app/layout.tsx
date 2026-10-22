import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ErrorReporter } from "@/components/ErrorReporter";
import { LangBoot } from "@/lib/i18n/client";

// 영어 사용자에게 서버가 그린 한국어가 잠깐 비치지 않도록, 언어가 정해질 때까지(최대 3초) 화면을 가린다
const LANG_HEAD = `try{var m=document.cookie.match(/(?:^|; )pw_lang=([A-Za-z-]+)/);var n=((navigator.languages&&navigator.languages[0])||navigator.language||"ko").toLowerCase();var l=m?m[1]:(n.indexOf("ko")===0?"ko":"x");if(l!=="ko"){if(l!=="x")document.documentElement.lang=l;if(l==="ar")document.documentElement.dir="rtl";document.documentElement.classList.add("i18n-wait");setTimeout(function(){document.documentElement.classList.remove("i18n-wait")},3000)}}catch(e){}`;

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://pinwith.me"),
  title: { default: "PinWith", template: "%s · PinWith" },
  description: "좋아하는 장소를 지도에 모아 링크 하나로 건네세요.",
  // 아이폰 '홈 화면에 추가' 아이콘(홈 화면 앱이어야 아이폰에서 알림을 받을 수 있다)
  icons: { apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "PinWith", statusBarStyle: "default" },
  // AdSense 사이트 확인용(<meta name="google-adsense-account">). 광고 계정 번호(ca-pub-…)를 넣으면 생긴다.
  ...(process.env.NEXT_PUBLIC_ADSENSE_CLIENT ? { other: { "google-adsense-account": process.env.NEXT_PUBLIC_ADSENSE_CLIENT } } : {}),
  // 네이버 서치어드바이저 소유 확인(10-22)
  verification: { other: { "naver-site-verification": "dc04edf740e70f0f9b04c9afa99e4c0fae23dda2" } },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: LANG_HEAD }} />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500..700&display=swap"
        />
      </head>
      <body className="min-h-full">
        <ErrorReporter />
        <LangBoot />
        {children}
      </body>
    </html>
  );
}
