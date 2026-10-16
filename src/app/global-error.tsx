"use client";
import { useEffect, useSyncExternalStore } from "react";
import { LANG_COOKIE, translate, type Lang } from "@/lib/i18n/core";
import { reportError } from "@/lib/reportError";
import { checkStale, reloadOnceIfStale } from "@/lib/buildCheck";

// 앱의 언어 도구 밖에서 그려지므로 언어 쿠키를 직접 읽는다
const noSubscribe = () => () => {};
const cookieLang = (): Lang => (document.cookie.match(new RegExp(`(?:^|; )${LANG_COOKIE}=en`)) ? "en" : "ko");

// 맨 바깥(루트 레이아웃)까지 오류가 올라왔을 때의 화면. 오류는 운영자 콘솔로 보낸다.
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const lang = useSyncExternalStore(noSubscribe, cookieLang, () => "ko" as Lang);
  const t = (ko: string) => translate(lang, ko);
  useEffect(() => {
    // 예전 배포의 탭이라 난 오류면 기록하지 않고 한 번 새로 불러온다
    checkStale(true).then((stale) => {
      if (stale && reloadOnceIfStale()) return;
      reportError(error, `global${stale ? " stale" : ""}${error.digest ? ` ${error.digest}` : ""}`);
    });
  }, [error]);
  return (
    <html lang={lang}>
      <body style={{ fontFamily: "system-ui, sans-serif", padding: 32, textAlign: "center" }}>
        <title>{`${t("문제가 생겼어요")} · PinWith`}</title>
        <h1 style={{ fontSize: 20 }}>{t("문제가 생겼어요")}</h1>
        <p style={{ color: "#666", fontSize: 14 }}>{t("오류는 운영자에게 자동으로 전달됐어요. 다시 시도하거나 잠시 뒤에 들어와 주세요.")}</p>
        <p style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 16 }}>
          <button type="button" onClick={() => retry()} style={{ padding: "8px 16px", borderRadius: 999, border: "1px solid #ccc", background: "#111", color: "#fff" }}>
            {t("다시 시도")}
          </button>
          {/* 오류 화면에서는 앱을 새로 불러오도록 일반 링크를 쓴다 */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" style={{ padding: "8px 16px", borderRadius: 999, border: "1px solid #ccc", color: "#111", textDecoration: "none" }}>{t("처음으로")}</a>
        </p>
      </body>
    </html>
  );
}
