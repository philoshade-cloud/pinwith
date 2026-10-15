import { serviceDb } from "@/lib/placeCoords";

// API 요청 제한: key(예: 'support:IP')마다 seconds 동안 limit번까지. 서버 키가 없으면 막지 않는다.
export async function allow(key: string, limit: number, seconds: number): Promise<boolean> {
  const db = serviceDb();
  if (!db) return true;
  const { data, error } = await db.rpc("rate_hit", { p_key: key, p_limit: limit, p_seconds: seconds });
  return error ? true : data !== false;
}

export function clientIp(req: Request) {
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
}

export const tooMany = () => Response.json({ error: "too_many" }, { status: 429 });
