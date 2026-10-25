"use client";
import { createClient } from "@/lib/supabase/client";
import { tr } from "@/lib/i18n/client";

// 새 리스트를 만들고 id를 돌려준다. 주소(slug)는 임시값이며 편집 화면에서 바꿀 수 있다.
export async function createEmptyList(title = tr("새 리스트")): Promise<string> {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("not-signed-in");
  const slug = `list-${Math.random().toString(36).slice(2, 8)}`;
  const { data, error } = await supabase
    .from("lists")
    .insert({ owner_id: auth.user.id, slug, title })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("insert-failed");
  return data.id;
}

export type NewItem = {
  listId: string;
  placeId: string;
  lat: number;
  lng: number;
  title: string;
  memo: string;
  sectionId: string | null;
  // 남의 리스트에서 담은 경우 원래 항목(출처 표시용)
  copiedFromItemId?: string | null;
};

export type AddedItem = {
  id: string;
  place_id: string;
  custom_title: string;
  memo: string;
  section_id: string | null;
  position: number;
  places: { lat: number | null; lng: number | null } | null;
};

export class DuplicatePlaceError extends Error {}

// 장소를 리스트 맨 뒤에 추가한다.
// place_id는 영구 저장, 좌표는 30일 캐시: 이미 있으면 만료된 경우에만 갱신된다(RLS).
export async function addPlaceToList(item: NewItem): Promise<AddedItem> {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("not-signed-in");

  const now = new Date().toISOString();
  const expired = new Date(Date.now() - 30 * 864e5).toISOString();
  const ins = await supabase
    .from("places")
    .upsert(
      { google_place_id: item.placeId, lat: item.lat, lng: item.lng, coords_fetched_at: now },
      { onConflict: "google_place_id", ignoreDuplicates: true },
    );
  if (ins.error) throw ins.error;
  await supabase
    .from("places")
    .update({ lat: item.lat, lng: item.lng, coords_fetched_at: now })
    .eq("google_place_id", item.placeId)
    .or(`coords_fetched_at.is.null,coords_fetched_at.lt.${expired}`);

  const { data: last } = await supabase
    .from("list_items")
    .select("position")
    .eq("list_id", item.listId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("list_items")
    .insert({
      list_id: item.listId,
      place_id: item.placeId,
      added_by: auth.user.id,
      custom_title: item.title,
      memo: item.memo,
      section_id: item.sectionId,
      copied_from_item_id: item.copiedFromItemId ?? null,
      position: (last?.position ?? -1) + 1,
    })
    .select("id, place_id, custom_title, memo, section_id, position, places(lat, lng)")
    .single();
  if (error?.code === "23505") throw new DuplicatePlaceError("duplicate");
  if (error || !data) throw error ?? new Error("insert-failed");
  return data as unknown as AddedItem;
}

// 마지막으로 장소를 저장한 리스트(다음 저장 때 먼저 골라 둔다). 이 기기에만 남는 편의 값.
const LAST_LIST_KEY = "pw_last_list";
export function rememberLastList(listId: string) {
  try {
    localStorage.setItem(LAST_LIST_KEY, listId);
  } catch {
    /* 저장소를 못 쓰면 넘어간다 */
  }
}
export function pickDefaultList(lists: { id: string }[]): string | null {
  try {
    const last = localStorage.getItem(LAST_LIST_KEY);
    if (last && lists.some((l) => l.id === last)) return last;
  } catch {
    /* 무시 */
  }
  return lists[0]?.id ?? null;
}
