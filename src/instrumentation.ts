import type { Instrumentation } from "next";

// 서버에서 난 오류를 오류 기록(error_logs)에 남긴다 → 운영자 콘솔 → 오류. 새 오류면 운영자에게 알림이 간다.
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { serviceDb } = await import("@/lib/placeCoords");
    const db = serviceDb();
    if (!db) return;
    const e = err as Error & { digest?: string };
    const message = `${e?.message || String(err)}${e?.digest ? ` (digest ${e.digest})` : ""}`;
    await db.rpc("log_error", {
      p_source: "server",
      p_message: message,
      p_stack: `${context.routeType} ${context.routePath}\n${e?.stack ?? ""}`,
      p_url: `${request.method} ${request.path}`,
      p_ua: String(request.headers["user-agent"] ?? ""),
      p_key: "server",
    });
  } catch {
    /* 기록 실패는 무시 */
  }
};
