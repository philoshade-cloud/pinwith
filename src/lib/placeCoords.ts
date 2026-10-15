import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./env";

// 구글 정책: 장소 ID는 계속 보관, 좌표는 30일까지만. 오래 아무도 안 본 장소는 좌표를 지워 두고,
// 누가 다시 열면 이 함수로 그 자리에서 다시 받는다(Place Details Essentials, 매달 1만 건 무료).
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://pinwith-xiea.vercel.app";

export function serviceDb() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return key ? createClient(SUPABASE_URL, key, { auth: { persistSession: false } }) : null;
}

export async function fetchLocation(placeId: string): Promise<{ lat: number; lng: number } | "gone" | null> {
  const key = process.env.GOOGLE_MAPS_SERVER_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
      headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": "location", Referer: `${SITE}/` },
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (res.status === 404) return "gone";
    if (!res.ok) return null;
    const p = (await res.json()) as { location?: { latitude: number; longitude: number } };
    return p.location ? { lat: p.location.latitude, lng: p.location.longitude } : null;
  } catch {
    return null;
  }
}

// 좌표가 비어 있는 장소들을 지금 받아 DB에 넣고 돌려준다. 서버 비밀 키가 없으면 아무것도 안 한다.
export async function fillMissingCoords(placeIds: string[], max = 30) {
  const out = new Map<string, { lat: number; lng: number }>();
  const db = serviceDb();
  if (!db || placeIds.length === 0) return out;
  const ids = [...new Set(placeIds)].slice(0, max);
  await Promise.all(
    ids.map(async (id) => {
      const loc = await fetchLocation(id);
      if (!loc || loc === "gone") return;
      out.set(id, loc);
      await db.from("places").update({ ...loc, coords_fetched_at: new Date().toISOString() }).eq("google_place_id", id);
    }),
  );
  return out;
}
