import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CuratedList, Curator, ListSummary } from "./types";

// URL의 핸들("%40hana.eats" 또는 "@hana.eats")을 정규화한다.
export function normalizeHandle(raw: string) {
  return decodeURIComponent(raw).replace(/^@/, "").toLowerCase();
}

async function getCurator(handle: string): Promise<Curator | null> {
  const supabase = await createClient();
  const { data: p } = await supabase
    .from("profiles")
    .select("id, handle, display_name, avatar_url, bio")
    .eq("handle", handle)
    .maybeSingle();
  if (!p) return null;
  const { count } = await supabase
    .from("follows")
    .select("*", { count: "exact", head: true })
    .eq("followee_id", p.id);
  return {
    id: p.id,
    handle: p.handle,
    displayName: p.display_name || p.handle,
    avatarUrl: p.avatar_url,
    bio: p.bio,
    followerCount: count ?? 0,
  };
}

export async function getCuratorPage(
  rawHandle: string,
): Promise<{ curator: Curator; lists: ListSummary[]; isOwner: boolean } | null> {
  const curator = await getCurator(normalizeHandle(rawHandle));
  if (!curator) return null;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const isOwner = auth.user?.id === curator.id;

  // 다른 사람에게는 공개 리스트만, 주인에게는 비공개·링크 공개까지 모두 보인다.
  let query = supabase
    .from("lists")
    .select(
      "id, slug, title, visibility, themes, like_count," +
        " list_items(id, place_id, custom_title, places(lat, lng))",
    )
    .eq("owner_id", curator.id)
    .order("updated_at", { ascending: false });
  if (!isOwner) query = query.eq("visibility", "public");
  const { data } = await query;

  type Row = {
    id: string; slug: string; title: string; visibility: ListSummary["visibility"];
    themes: string[]; like_count: number;
    list_items: { id: string; place_id: string; custom_title: string; places: { lat: number | null; lng: number | null } | null }[];
  };
  const lists: ListSummary[] = ((data ?? []) as unknown as Row[]).map((l) => ({
    id: l.id,
    slug: l.slug,
    title: l.title,
    visibility: l.visibility,
    themes: l.themes,
    likeCount: l.like_count,
    itemCount: l.list_items.length,
    pins: l.list_items.map((i) => ({
      id: i.id,
      title: i.custom_title,
      placeId: i.place_id,
      lat: i.places?.lat ?? null,
      lng: i.places?.lng ?? null,
    })),
  }));
  return { curator, lists, isOwner };
}

export async function getCuratedList(
  rawHandle: string,
  slug: string,
): Promise<CuratedList | null> {
  const curator = await getCurator(normalizeHandle(rawHandle));
  if (!curator) return null;
  const supabase = await createClient();
  // RLS가 공개 범위를 판단한다: 공개·링크 공개는 누구나, 비공개는 주인·편집자만.
  const { data: list } = await supabase
    .from("lists")
    .select(
      "id, slug, title, description, visibility, kind, themes, like_count, updated_at," +
        " sections(id, name, position)," +
        " list_items(id, place_id, custom_title, memo, section_id, position, tags, video_ts_url, places(lat, lng))",
    )
    .eq("owner_id", curator.id)
    .eq("slug", decodeURIComponent(slug))
    .maybeSingle();
  if (!list) return null;

  type Row = {
    id: string; slug: string; title: string; description: string;
    visibility: CuratedList["visibility"]; kind: CuratedList["kind"];
    themes: string[]; like_count: number; updated_at: string;
    sections: { id: string; name: string; position: number }[];
    list_items: {
      id: string; place_id: string; custom_title: string; memo: string;
      section_id: string | null; position: number; tags: string[];
      video_ts_url: string | null; places: { lat: number | null; lng: number | null } | null;
    }[];
  };
  const row = list as unknown as Row;

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    visibility: row.visibility,
    kind: row.kind,
    themes: row.themes,
    likeCount: row.like_count,
    updatedAt: row.updated_at,
    curator,
    sections: [...row.sections].sort((a, b) => a.position - b.position),
    items: [...row.list_items]
      .sort((a, b) => a.position - b.position)
      .map((i) => ({
        id: i.id,
        placeId: i.place_id,
        title: i.custom_title,
        memo: i.memo,
        sectionId: i.section_id,
        position: i.position,
        tags: i.tags,
        videoUrl: i.video_ts_url,
        lat: i.places?.lat ?? null,
        lng: i.places?.lng ?? null,
      })),
  };
}

// 로그인한 사람의 지도(홈 화면용). 로그인하지 않았으면 null.
export async function getMyCuratorPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data: p } = await supabase.from("profiles").select("handle").eq("id", auth.user.id).maybeSingle();
  if (!p) return null;
  return getCuratorPage(p.handle);
}
