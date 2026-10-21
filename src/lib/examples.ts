"use client";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLang } from "@/lib/i18n/client";
import type { ListItem } from "./types";

// 로그인 전에 보여 줄 예시 리스트(언어별 3개: 평범한 것 · 크리에이터 스타일 · 친구들이 의논한 것).
// 어떤 리스트를 보여 줄지는 app_flags.examples = { ko: [[핸들, 주소], …], en: [...] } 에서 정한다(운영자가 DB에서 바꿈).
export type ExampleList = {
  id: string;
  slug: string;
  title: string;
  themes: string[];
  like_count: number;
  owner_id: string;
  is_example: boolean;
  owner: { handle: string; display_name: string; is_official?: boolean } | null;
  list_items: { count: number }[];
  href: string;
};

const SELECT =
  "id, slug, title, themes, like_count, owner_id, is_example, owner:profiles!lists_owner_id_fkey!inner(handle, display_name, is_official), list_items(count)";

export function useExampleLists() {
  const lang = useLang();
  const supabase = useMemo(() => createClient(), []);
  const [lists, setLists] = useState<ExampleList[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: flag } = await supabase.from("app_flags").select("value").eq("key", "examples").maybeSingle();
      const byLang = flag?.value as Record<string, [string, string][]> | null;
      // 그 언어의 예시가 아직 없으면 영어 예시
      const pairs = (byLang?.[lang] ?? byLang?.en ?? []).slice(0, 3);
      if (!pairs.length) return !cancelled && setLists([]);
      const rows = await Promise.all(
        pairs.map(([handle, slug]) =>
          supabase.from("lists").select(SELECT).eq("owner.handle", handle).eq("slug", slug).eq("visibility", "public").maybeSingle(),
        ),
      );
      if (cancelled) return;
      setLists(
        rows.flatMap(({ data }) => {
          const l = data as unknown as Omit<ExampleList, "href"> | null;
          return l?.owner ? [{ ...l, href: `/@${l.owner.handle}/${l.slug}` }] : [];
        }),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, lang]);
  return lists;
}

// 첫 화면 지도에 깔 예시 리스트의 핀
export async function loadExamplePins(listId: string): Promise<ListItem[]> {
  const { data } = await createClient()
    .from("list_items")
    .select("id, place_id, custom_title, memo, section_id, position, tags, video_ts_url, places(lat, lng)")
    .eq("list_id", listId)
    .order("position");
  type Row = { id: string; place_id: string; custom_title: string; memo: string | null; section_id: string | null; position: number; tags: string[] | null; video_ts_url: string | null; places: { lat: number | null; lng: number | null } | null };
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id, placeId: r.place_id, title: r.custom_title, memo: r.memo ?? "", sectionId: r.section_id, position: r.position,
    tags: r.tags ?? [], videoUrl: r.video_ts_url, lat: r.places?.lat ?? null, lng: r.places?.lng ?? null,
  }));
}
