"use client";
import { createClient } from "@/lib/supabase/client";

// 화면에서 난 오류를 운영자 콘솔(오류)로 보낸다. 같은 오류는 횟수만 늘어난다.
const sent = new Set<string>();

export function reportError(err: unknown, where = "") {
  try {
    const e = err instanceof Error ? err : new Error(typeof err === "string" ? err : JSON.stringify(err ?? null));
    const msg = `${where ? `[${where}] ` : ""}${e.message || "(no message)"}`;
    // 확장 프로그램·외부 스크립트에서 난, 내용 없는 오류는 건너뛴다
    if (/^Script error\.?$/i.test(e.message) || /ResizeObserver loop/.test(e.message)) return;
    if (sent.has(msg) || sent.size > 20) return;
    sent.add(msg);
    let key: string | null = null;
    try {
      key = localStorage.getItem("pw-viewer");
    } catch {}
    createClient()
      .rpc("log_error", { p_source: "client", p_message: msg, p_stack: e.stack ?? null, p_url: location.href, p_ua: navigator.userAgent, p_key: key })
      .then(() => {});
  } catch {
    /* 무시 */
  }
}
