import "server-only";
import { cacheLife } from "next/cache";
import { CITIES, MIN_LISTS, distanceKm, findCity } from "@/lib/cities";
import { isSupabaseConfigured } from "@/lib/env";
import { isLang, type Lang } from "@/lib/i18n/core";
import { anon } from "@/lib/public";

// 도시별 소개 페이지 데이터: 공개 리스트를 장소 좌표로 도시에 나눈다(공개 리스트가 많지 않아 한 번에 읽어 나눈다).
export type LandingList = {
  path: string;
  title: string;
  description: string;
  lang: Lang;
  handle: string;
  curatorName: string;
  themes: string[];
  likes: number;
  updatedAt: string;
  places: string[];
  count: number;
};

type Row = {
  slug: string; title: string; description: string | null; lang: string | null; themes: string[] | null; like_count: number | null; updated_at: string;
  owner: { handle: string; display_name: string | null; lang: string | null };
  list_items: { position: number; custom_title: string | null; places: { lat: number | null; lng: number | null } | null }[];
};

async function cityLists(): Promise<Record<string, LandingList[]>> {
  "use cache";
  cacheLife("hours");
  if (!isSupabaseConfigured()) return {};
  const { data } = await anon()
    .from("lists")
    .select(
      "slug, title, description, lang, themes, like_count, updated_at, owner:profiles!lists_owner_id_fkey!inner(handle, display_name, lang)," +
        " list_items(position, custom_title, places(lat, lng))",
    )
    .eq("visibility", "public")
    .limit(3000);
  const out: Record<string, LandingList[]> = {};
  for (const r of (data ?? []) as unknown as Row[]) {
    const items = [...r.list_items].sort((a, b) => a.position - b.position);
    const pins = items.flatMap((i) => (i.places?.lat != null && i.places?.lng != null ? [{ lat: i.places.lat, lng: i.places.lng }] : []));
    if (!pins.length) continue;
    const lang = r.lang ?? r.owner.lang;
    const list: LandingList = {
      path: `/@${r.owner.handle}/${encodeURIComponent(r.slug)}`,
      title: r.title,
      description: r.description ?? "",
      lang: isLang(lang) ? lang : "ko",
      handle: r.owner.handle,
      curatorName: r.owner.display_name || r.owner.handle,
      themes: (r.themes ?? []).slice(0, 5),
      likes: r.like_count ?? 0,
      updatedAt: r.updated_at,
      places: items.flatMap((i) => (i.custom_title ? [i.custom_title] : [])),
      count: items.length,
    };
    for (const c of CITIES) {
      const inside = pins.filter((p) => distanceKm(p.lat, p.lng, c.lat, c.lng) <= c.radius).length;
      if (inside * 2 >= pins.length) (out[c.slug] ??= []).push(list);
    }
  }
  for (const k of Object.keys(out)) out[k].sort((a, b) => b.likes - a.likes || b.updatedAt.localeCompare(a.updatedAt));
  return out;
}

// 페이지가 있는 도시와, 그 도시에서 페이지를 낼 언어들.
// 영어는 항상(기본 언어), 나머지 언어는 그 언어로 된 리스트가 하나라도 있을 때만(같은 내용의 빈 번역 페이지를 만들지 않게).
export async function landingCities(): Promise<{ slug: string; count: number; langs: Lang[]; updatedAt: string }[]> {
  const all = await cityLists();
  return CITIES.flatMap((c) => {
    const lists = all[c.slug] ?? [];
    if (lists.length < MIN_LISTS) return [];
    const langs = [...new Set<Lang>(["en", ...lists.map((l) => l.lang)])];
    const updatedAt = lists.reduce((m, l) => (l.updatedAt > m ? l.updatedAt : m), lists[0].updatedAt);
    return [{ slug: c.slug, count: lists.length, langs, updatedAt }];
  });
}

export async function landingCity(slug: string, lang: Lang) {
  const city = findCity(slug);
  if (!city) return null;
  const all = await cityLists();
  const lists = all[slug] ?? [];
  if (lists.length < MIN_LISTS) return null;
  const langs = [...new Set<Lang>(["en", ...lists.map((l) => l.lang)])];
  if (!langs.includes(lang)) return null;
  return { city, langs, mine: lists.filter((l) => l.lang === lang), others: lists.filter((l) => l.lang !== lang) };
}
