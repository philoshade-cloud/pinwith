import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CuratedList, Curator, ListSummary } from "./types";
import { fillMissingCoords } from "./placeCoords";

// URL의 핸들("%40hana.eats" 또는 "@hana.eats")을 정규화한다.
export function normalizeHandle(raw: string) {
  return decodeURIComponent(raw).replace(/^@/, "").toLowerCase();
}

// 로그인한 사람의 id. 토큰을 이 서버에서 검증하므로 인증 서버 왕복이 없다.
async function myId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase.auth.getClaims();
  return (data?.claims?.sub as string | undefined) ?? null;
}

const CURATOR_FIELDS =
  "id, handle, display_name, avatar_url, bio, is_official, followers:follows!follows_followee_id_fkey(count)";

type CuratorRow = {
  id: string; handle: string; display_name: string; avatar_url: string | null; bio: string; is_official?: boolean;
  followers: { count: number }[];
};

function toCurator(p: CuratorRow): Curator {
  return {
    id: p.id,
    handle: p.handle,
    displayName: p.display_name || p.handle,
    avatarUrl: p.avatar_url,
    bio: p.bio,
    followerCount: p.followers?.[0]?.count ?? 0,
    official: !!p.is_official,
  };
}

type SummaryRow = {
  id: string; slug: string; title: string; visibility: ListSummary["visibility"];
  themes: string[]; like_count: number;
  list_items: { id: string; place_id: string; custom_title: string; places: { lat: number | null; lng: number | null } | null }[];
};

// 데이터베이스 왕복을 줄이려고 프로필과 리스트를 동시에 읽는다(서버와 DB가 같은 지역에 있어야 빠르다).
export async function getCuratorPage(
  rawHandle: string,
): Promise<{ curator: Curator; lists: ListSummary[]; isOwner: boolean } | null> {
  const handle = normalizeHandle(rawHandle);
  const supabase = await createClient();
  const [uid, { data: p }, { data }] = await Promise.all([
    myId(supabase),
    supabase.from("profiles").select(CURATOR_FIELDS).eq("handle", handle).maybeSingle(),
    // 공개 범위는 RLS가 판단: 남에게는 공개·링크 공개만, 주인에게는 전부
    supabase
      .from("lists")
      .select(
        "id, slug, title, visibility, themes, like_count, owner:profiles!lists_owner_id_fkey!inner(handle)," +
          " list_items(id, place_id, custom_title, places(lat, lng))",
      )
      .eq("owner.handle", handle)
      .order("updated_at", { ascending: false }),
  ]);
  if (!p) return null;
  const curator = toCurator(p as unknown as CuratorRow);
  const isOwner = uid === curator.id;
  const rows = ((data ?? []) as unknown as SummaryRow[]).filter((l) => isOwner || l.visibility === "public");
  // 열람 기록(좌표 갱신 대상 판단용)과, 좌표가 지워진 장소 다시 받기
  const missing = rows.flatMap((l) => l.list_items.filter((i) => i.places?.lat == null).map((i) => i.place_id));
  const [, filled] = await Promise.all([
    rows.length ? supabase.rpc("touch_lists", { ids: rows.map((l) => l.id) }) : null,
    fillMissingCoords(missing),
  ]);
  const lists: ListSummary[] = rows.map((l) => ({
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
      lat: i.places?.lat ?? filled.get(i.place_id)?.lat ?? null,
      lng: i.places?.lng ?? filled.get(i.place_id)?.lng ?? null,
    })),
  }));
  return { curator, lists, isOwner };
}

export async function getCuratedList(
  rawHandle: string,
  slug: string,
): Promise<CuratedList | null> {
  const handle = normalizeHandle(rawHandle);
  const supabase = await createClient();
  // 리스트(큐레이터 포함)와 같은 큐레이터의 다른 리스트를 동시에 읽는다. 공개 범위는 RLS가 판단한다.
  const [{ data: list }, { data: others }, uid] = await Promise.all([
    supabase
      .from("lists")
      .select(
        "id, slug, title, description, visibility, kind, themes, like_count, updated_at, public_comments," +
          ` owner:profiles!lists_owner_id_fkey!inner(${CURATOR_FIELDS}),` +
          " sections(id, name, position)," +
          " list_items(id, place_id, custom_title, memo, section_id, position, tags, video_ts_url, places(lat, lng))",
      )
      .eq("owner.handle", handle)
      .eq("slug", decodeURIComponent(slug))
      .maybeSingle(),
    supabase
      .from("lists")
      .select("slug, title, visibility, owner:profiles!lists_owner_id_fkey!inner(handle)")
      .eq("owner.handle", handle)
      .order("updated_at", { ascending: false }),
    myId(supabase),
  ]);
  if (!list) return null;

  type Row = {
    id: string; slug: string; title: string; description: string;
    visibility: CuratedList["visibility"]; kind: CuratedList["kind"];
    themes: string[]; like_count: number; updated_at: string; public_comments: boolean;
    owner: CuratorRow;
    sections: { id: string; name: string; position: number }[];
    list_items: {
      id: string; place_id: string; custom_title: string; memo: string;
      section_id: string | null; position: number; tags: string[];
      video_ts_url: string | null; places: { lat: number | null; lng: number | null } | null;
    }[];
  };
  const row = list as unknown as Row;
  const curator = toCurator(row.owner);
  const isOwner = uid === curator.id;
  const [, filled, { data: sponsoredRows }] = await Promise.all([
    supabase.rpc("touch_lists", { ids: [row.id] }),
    fillMissingCoords(row.list_items.filter((i) => i.places?.lat == null).map((i) => i.place_id)),
    supabase.rpc("list_sponsored_items", { p_list: row.id }),
  ]);
  const sponsored = new Set(((sponsoredRows ?? []) as unknown[]).map((r) => (typeof r === "string" ? r : Object.values(r as object)[0]) as string));
  const siblings = ((others ?? []) as unknown as { slug: string; title: string; visibility: string }[])
    .filter((l) => isOwner || l.visibility === "public" || l.slug === row.slug)
    .map((l) => ({ slug: l.slug, title: l.title }));

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
    publicComments: row.public_comments,
    curator,
    siblings,
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
        lat: i.places?.lat ?? filled.get(i.place_id)?.lat ?? null,
        lng: i.places?.lng ?? filled.get(i.place_id)?.lng ?? null,
        sponsored: sponsored.has(i.id),
      })),
  };
}

// 로그인한 사람의 지도(홈 화면용). 로그인하지 않았으면 null.
export async function getMyCuratorPage() {
  const supabase = await createClient();
  const uid = await myId(supabase);
  if (!uid) return null;
  const { data: p } = await supabase.from("profiles").select("handle").eq("id", uid).maybeSingle();
  if (!p) return null;
  return getCuratorPage(p.handle);
}
