// 임시: 서버 설정 점검용(값은 보여주지 않고 있는지만). 확인 후 삭제한다.
import { connection } from "next/server";
import { fetchLocation, serviceDb } from "@/lib/placeCoords";

export async function GET() {
  await connection();
  const db = serviceDb();
  let dbOk: boolean | string = false;
  if (db) {
    const { error } = await db.rpc("places_to_refresh", { lim: 1 });
    dbOk = error ? error.message.slice(0, 80) : true;
  }
  const loc = await fetchLocation("ChIJ8VYk1e74IBURIIVPcKTynRI");
  return Response.json({
    serviceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    cronSecret: !!process.env.CRON_SECRET,
    serviceDb: dbOk,
    google: loc === null ? "fail" : loc === "gone" ? "gone" : "ok",
  });
}
