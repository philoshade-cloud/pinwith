import { connection } from "next/server";
import { fetchLocation, serviceDb } from "@/lib/placeCoords";

// 매일 한 번(Vercel Cron)
// 1) 최근 30일 안에 누가 본 리스트의 장소 중, 좌표를 받은 지 25일이 넘은 것만 다시 받는다.
// 2) 30일 동안 아무도 안 본 장소의 좌표는 지운다(다시 열리면 그때 받는다).
// 3) 보관 기간이 지난 예약 문의 개인정보를 지운다.
// 필요한 환경 변수: SUPABASE_SERVICE_ROLE_KEY(DB 쓰기), CRON_SECRET(호출 확인)
const BATCH = 300;

export async function GET(req: Request) {
  await connection();
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("unauthorized", { status: 401 });
  }
  const db = serviceDb();
  if (!db) return Response.json({ skipped: "missing SUPABASE_SERVICE_ROLE_KEY" });

  const { data: rows } = await db.rpc("places_to_refresh", { lim: BATCH });
  let updated = 0, gone = 0;
  for (const { google_place_id: id } of (rows ?? []) as { google_place_id: string }[]) {
    const loc = await fetchLocation(id);
    if (loc === "gone") {
      await db.from("places").update({ lat: null, lng: null, coords_fetched_at: new Date().toISOString() }).eq("google_place_id", id);
      gone++;
    } else if (loc) {
      await db.from("places").update({ ...loc, coords_fetched_at: new Date().toISOString() }).eq("google_place_id", id);
      updated++;
    }
  }
  const { data: expired } = await db.rpc("expire_unviewed_coords");
  // 3) 방문일로부터 1년이 지난 예약 문의의 이름·연락처·메시지를 지운다(개인정보처리방침 6번)
  const { data: anonymized } = await db.rpc("anonymize_old_reservations");
  return Response.json({ checked: rows?.length ?? 0, updated, gone, expired, anonymized });
}
