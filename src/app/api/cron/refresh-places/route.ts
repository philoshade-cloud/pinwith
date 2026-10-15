import { connection } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/env";

// 매일 한 번(Vercel Cron): 받은 지 25일이 넘은 장소 좌표를 구글에서 다시 받는다.
// 구글 정책상 좌표는 30일까지만 보관할 수 있다. 장소 ID는 계속 보관 가능.
// 필요한 환경 변수: SUPABASE_SERVICE_ROLE_KEY(DB 쓰기), CRON_SECRET(호출 확인)
const BATCH = 300;

export async function GET(req: Request) {
  await connection();
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("unauthorized", { status: 401 });
  }
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const mapsKey = process.env.GOOGLE_MAPS_SERVER_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!serviceKey || !mapsKey) return Response.json({ skipped: "missing env" });

  const db = createClient(SUPABASE_URL, serviceKey, { auth: { persistSession: false } });
  const stale = new Date(Date.now() - 25 * 864e5).toISOString();
  const { data: rows } = await db
    .from("places")
    .select("google_place_id")
    .or(`coords_fetched_at.is.null,coords_fetched_at.lt.${stale}`)
    .limit(BATCH);

  let updated = 0, gone = 0;
  for (const { google_place_id: id } of rows ?? []) {
    // Place Details Essentials(좌표만): 매달 1만 건까지 무료
    const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(id)}`, {
      headers: {
        "X-Goog-Api-Key": mapsKey,
        "X-Goog-FieldMask": "location",
        Referer: `${process.env.NEXT_PUBLIC_SITE_URL || "https://pinwith-xiea.vercel.app"}/`,
      },
      cache: "no-store",
    });
    if (res.status === 404) {
      // 구글에서 사라진 장소: 좌표를 지워 지도에 잘못된 위치가 남지 않게 한다
      await db.from("places").update({ lat: null, lng: null, coords_fetched_at: new Date().toISOString() }).eq("google_place_id", id);
      gone++;
      continue;
    }
    if (!res.ok) continue;
    const p = (await res.json()) as { location?: { latitude: number; longitude: number } };
    if (!p.location) continue;
    await db
      .from("places")
      .update({ lat: p.location.latitude, lng: p.location.longitude, coords_fetched_at: new Date().toISOString() })
      .eq("google_place_id", id);
    updated++;
  }
  return Response.json({ checked: rows?.length ?? 0, updated, gone });
}
