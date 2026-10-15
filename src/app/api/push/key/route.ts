import { connection } from "next/server";
import { serviceDb } from "@/lib/placeCoords";
import { vapidKeys } from "@/lib/push";
import { allow, clientIp, tooMany } from "@/lib/rateLimit";

// 브라우저가 알림을 구독할 때 쓰는 공개 키
export async function GET(req: Request) {
  await connection();
  if (!(await allow(`pkey:${clientIp(req)}`, 60, 60))) return tooMany();
  const db = serviceDb();
  if (!db) return Response.json({ error: "not_ready" }, { status: 503 });
  const keys = await vapidKeys(db);
  if (!keys) return Response.json({ error: "not_ready" }, { status: 503 });
  return Response.json({ publicKey: keys.publicKey });
}
