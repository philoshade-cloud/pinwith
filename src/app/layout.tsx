import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://pinwith-xiea.vercel.app"),
  title: { default: "PinWith", template: "%s · PinWith" },
  description: "좋아하는 장소를 지도에 모아 링크 하나로 건네세요.",
  // 아이폰 '홈 화면에 추가' 아이콘(홈 화면 앱이어야 아이폰에서 알림을 받을 수 있다)
  icons: { apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "PinWith", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full">
      <head>
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
      <body className="min-h-full">{children}</body>
    </html>
  );
}
