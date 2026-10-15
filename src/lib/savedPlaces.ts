"use client";
import { createClient } from "@/lib/supabase/client";
import type { FoundPlace } from "@/components/PlaceSearch";

// PinWith 사용자들이 이미 담아 둔 장소에서 먼저 찾는다(구글 요금 없음).
// 공개 리스트에 있는 장소만 찾고, 여러 리스트에 담긴 장소를 위로 올린다.
export async function searchSavedPlaces(q: string, limit = 15): Promise<(FoundPlace & { lists: number })[]> {
  const term = q.trim().replace(/[%_\\,()]/g, " ").trim();
  if (!term) return [];
  try {
    const { data } = await createClient()
      .from("list_items")
      .select("place_id, custom_title, places(lat, lng), lists!inner(visibility)")
      .eq("lists.visibility", "public")
      .ilike("custom_title", `%${term}%`)
      .limit(60);
    const byPlace = new Map<string, FoundPlace & { lists: number }>();
    for (const r of (data ?? []) as unknown as {
      place_id: string; custom_title: string; places: { lat: number | null; lng: number | null } | null;
    }[]) {
      if (r.places?.lat == null || r.places?.lng == null) continue;
      const hit = byPlace.get(r.place_id);
      if (hit) hit.lists++;
      else
        byPlace.set(r.place_id, {
          id: r.place_id, name: r.custom_title, address: "", lat: r.places.lat, lng: r.places.lng, lists: 1,
        });
    }
    return [...byPlace.values()].sort((a, b) => b.lists - a.lists).slice(0, limit);
  } catch {
    return [];
  }
}
