"use client";
import { useEffect } from "react";
import { reportError } from "@/lib/reportError";
import { checkStale, isStaleKnown } from "@/lib/buildCheck";

// 화면 전체에서 잡히지 않은 오류를 모아 보낸다(운영자 콘솔 → 오류).
// 탭을 다시 열 때 새 배포가 있는지 보고, 있으면 다음 화면 이동은 새로 불러오기로 한다.
export function ErrorReporter() {
  useEffect(() => {
    const onError = (ev: ErrorEvent) => reportError(ev.error ?? ev.message, "window");
    const onRejection = (ev: PromiseRejectionEvent) => reportError(ev.reason, "promise");
    const onVisible = () => {
      if (document.visibilityState === "visible") checkStale();
    };
    // 예전 배포 탭에서 사이트 안 링크를 누르면 앱 안 이동 대신 새로 불러온다
    const onClick = (ev: MouseEvent) => {
      if (!isStaleKnown() || ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
      const a = (ev.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target || a.hasAttribute("download") || a.origin !== location.origin) return;
      ev.preventDefault();
      location.assign(a.href);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    document.addEventListener("visibilitychange", onVisible);
    document.addEventListener("click", onClick, true);
    const timer = setInterval(() => checkStale(), 30 * 60_000);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      document.removeEventListener("visibilitychange", onVisible);
      document.removeEventListener("click", onClick, true);
      clearInterval(timer);
    };
  }, []);
  return null;
}
