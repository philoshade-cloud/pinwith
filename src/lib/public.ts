import "server-only";
import { cacheLife } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, isSupabaseConfigured } from "./env";
import { normalizeHandle } from "./data";

// 공유 미리보기(카톡·인스타 링크 카드)용. 로그인 없이 누구나 보는 정보만 읽는다(RLS가 공개 범위를 판단).
function anon() {
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
}

export type Preview = {
  title: string;
  description: string;
  curatorName: string;
  handle: string;
  count: number;
  course: boolean;
  themes: string[];
  pins: { lat: number; lng: number }[];
};

export async function getListPreview(rawHandle: string, slug: string): Promise<Preview | null> {
  "use cache";
  cacheLife("minutes");
  if (!isSupabaseConfigured()) return null;
  const handle = normalizeHandle(rawHandle);
  const { data } = await anon()
    .from("lists")
    .select(
      "title, description, kind, themes, owner:profiles!lists_owner_id_fkey!inner(handle, display_name)," +
        " list_items(position, places(lat, lng))",
    )
    .eq("owner.handle", handle)
    .eq("slug", decodeURIComponent(slug))
    .maybeSingle();
  if (!data) return null;
  const row = data as unknown as {
    title: string; description: string; kind: string; themes: string[];
    owner: { handle: string; display_name: string };
    list_items: { position: number; places: { lat: number | null; lng: number | null } | null }[];
  };
  return {
    title: row.title,
    description: row.description,
    curatorName: row.owner.display_name || row.owner.handle,
    handle: row.owner.handle,
    count: row.list_items.length,
    course: row.kind === "course",
    themes: row.themes,
    pins: [...row.list_items]
      .sort((a, b) => a.position - b.position)
      .flatMap((i) => (i.places?.lat != null && i.places?.lng != null ? [{ lat: i.places.lat, lng: i.places.lng }] : [])),
  };
}

export async function getCuratorPreview(rawHandle: string): Promise<Preview | null> {
  "use cache";
  cacheLife("minutes");
  if (!isSupabaseConfigured()) return null;
  const handle = normalizeHandle(rawHandle);
  const db = anon();
  const [{ data: p }, { data: lists }] = await Promise.all([
    db.from("profiles").select("handle, display_name, bio").eq("handle", handle).maybeSingle(),
    db
      .from("lists")
      .select("visibility, themes, owner:profiles!lists_owner_id_fkey!inner(handle), list_items(places(lat, lng))")
      .eq("owner.handle", handle)
      .eq("visibility", "public"),
  ]);
  if (!p) return null;
  const rows = (lists ?? []) as unknown as { themes: string[]; list_items: { places: { lat: number | null; lng: number | null } | null }[] }[];
  const pins = rows.flatMap((l) =>
    l.list_items.flatMap((i) => (i.places?.lat != null && i.places?.lng != null ? [{ lat: i.places.lat, lng: i.places.lng }] : [])),
  );
  return {
    title: p.display_name || p.handle,
    description: p.bio || `${p.display_name || p.handle}의 장소 지도`,
    curatorName: p.display_name || p.handle,
    handle: p.handle,
    count: pins.length,
    course: false,
    themes: [...new Set(rows.flatMap((l) => l.themes))].slice(0, 4),
    pins,
  };
}

// 링크 미리보기 그림에 쓸 한글 글꼴. 그림에 들어가는 글자만 구글 글꼴에서 받아 온다.
export async function loadKoreanFont(text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await (
      await fetch(`https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@700&text=${encodeURIComponent(text)}`, {
        // 옛 브라우저처럼 요청하면 woff2 대신 truetype을 준다(그림 생성기가 woff2를 못 읽음)
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/534.30 (KHTML, like Gecko) Safari/534.30" },
      })
    ).text();
    const url = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
    if (!url) return null;
    return await (await fetch(url)).arrayBuffer();
  } catch {
    return null;
  }
}

// 검색엔진·광고 심사 로봇이 찾을 수 있게 공개 리스트 주소를 모은다(sitemap.xml)
export async function getPublicListPaths(): Promise<{ path: string; updatedAt: string }[]> {
  "use cache";
  cacheLife("hours");
  if (!isSupabaseConfigured()) return [];
  const { data } = await anon()
    .from("lists")
    .select("slug, updated_at, owner:profiles!lists_owner_id_fkey!inner(handle)")
    .eq("visibility", "public")
    .order("updated_at", { ascending: false })
    .limit(5000);
  const rows = (data ?? []) as unknown as { slug: string; updated_at: string; owner: { handle: string } }[];
  return rows.map((r) => ({ path: `/@${r.owner.handle}/${r.slug}`, updatedAt: r.updated_at }));
}
