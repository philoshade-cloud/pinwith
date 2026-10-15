"use client";
// 요금이 나가는 외부 서비스 사용량을 센다(운영자 콘솔 → 서비스 사용량, 예산 알림).
// 실패해도 사용자 동작은 막지 않는다.
import { createClient } from "@/lib/supabase/client";

export type UsageKind = "maps_card" | "autocomplete" | "text_search" | "maps_js";

function viewer() {
  try {
    return localStorage.getItem("pw-viewer") ?? undefined;
  } catch {
    return undefined;
  }
}

export function logUsage(kind: UsageKind, n = 1) {
  try {
    createClient()
      .rpc("log_usage", { p_kind: kind, p_n: n, p_key: viewer() ?? null })
      .then(() => {});
  } catch {
    /* 무시 */
  }
}
