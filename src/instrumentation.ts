import type { Instrumentation } from "next";

// 서버에서 난 오류를 오류 기록(error_logs)에 남긴다 → 운영자 콘솔 → 오류. 새 오류면 운영자에게 알림이 간다.
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // PinWith에는 서버 액션이 없다. 페이지로 오는 POST(서버 액션 흉내)는 외부 로봇의 탐색이라 기록하지 않는다
  // (예: 10-21 'Couldn't find all resumable slots…' POST /, Linux Chrome 131).
  if (context.routeType === "action" || (request.method === "POST" && context.routeType === "render")) return;
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
