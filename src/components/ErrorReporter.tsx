"use client";
import { useEffect } from "react";
import { reportError } from "@/lib/reportError";

// 화면 전체에서 잡히지 않은 오류를 모아 보낸다(운영자 콘솔 → 오류)
export function ErrorReporter() {
  useEffect(() => {
    const onError = (ev: ErrorEvent) => reportError(ev.error ?? ev.message, "window");
    const onRejection = (ev: PromiseRejectionEvent) => reportError(ev.reason, "promise");
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
