"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ListItem } from "@/lib/types";
import { Panel, PanelLoading } from "./shell/Panel";
import { useMapScene, type Scene } from "./shell/context";

type Row = {
  id: string;
  slug: string;
  title: string;
  updated_at: string;
  like_count: number;
  owner: { handle: string; display_name: string } | null;
  list_items: { id: string; place_id: string; custom_title: string; places: { lat: number | null; lng: number | null } | null }[];
};

const ago = (iso: string) => {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
  return d <= 0 ? "오늘" : d < 7 ? `${d}일 전` : d < 30 ? `${Math.floor(d / 7)}주 전` : `${Math.floor(d / 30)}달 전`;
};

// /following — 내가 팔로우하는 사람들의 공개 리스트. 지도에는 그 리스트들의 핀을 모두 보여준다.
export function FollowingView() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [following, setFollowing] = useState<Row[] | null>(null);
  const [liked, setLiked] = useState<Row[]>([]);
  const [tab, setTab] = useState<"following" | "liked">("following");
  const [people, setPeople] = useState(0);
  const rows = tab === "following" ? following : liked;

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.replace("/login?next=/following");
        return;
      }
      const [{ data: f }, { data: likes }] = await Promise.all([
        supabase.from("follows").select("followee_id").eq("follower_id", auth.user.id),
        // 좋아요한 리스트(3.7)
        supabase
          .from("list_likes")
          .select(
            "created_at, list:lists(id, slug, title, updated_at, like_count, owner:profiles!lists_owner_id_fkey(handle, display_name)," +
              " list_items(id, place_id, custom_title, places(lat, lng)))",
          )
          .eq("user_id", auth.user.id)
          .order("created_at", { ascending: false })
          .limit(60),
      ]);
      setLiked(((likes ?? []) as unknown as { list: Row | null }[]).map((x) => x.list).filter((l): l is Row => !!l));
      const ids = (f ?? []).map((x) => x.followee_id as string);
      setPeople(ids.length);
      if (ids.length === 0) return setFollowing([]);
      const { data } = await supabase
        .from("lists")
        .select(
          "id, slug, title, updated_at, like_count, owner:profiles!lists_owner_id_fkey(handle, display_name)," +
            " list_items(id, place_id, custom_title, places(lat, lng))",
        )
        .in("owner_id", ids)
        .eq("visibility", "public")
        .order("updated_at", { ascending: false })
        .limit(60);
      const found = ((data ?? []) as unknown as Row[]).filter((l) => l.list_items.length > 0);
      setFollowing(found);
      // 열람 기록(좌표 갱신 대상 판단용)
      if (found.length) supabase.rpc("touch_lists", { ids: found.map((l) => l.id) }).then(() => {});
    })();
  }, [supabase, router]);

  const scene: Scene | null = useMemo(() => {
    if (!rows) return null;
    const listOf = new Map<string, Row>();
    const items: ListItem[] = rows.flatMap((l) =>
      l.list_items.map((i, n) => {
        listOf.set(i.id, l);
        return {
          id: i.id, placeId: i.place_id, title: i.custom_title, memo: "", sectionId: null,
          position: n, tags: [], videoUrl: null, lat: i.places?.lat ?? null, lng: i.places?.lng ?? null,
        };
      }),
    );
    return {
      items,
      listIdOf: (i) => listOf.get(i.id)?.id,
      cardExtra: (i) => {
        const l = listOf.get(i.id);
        return l?.owner ? (
          <Link href={`/@${l.owner.handle}/${l.slug}`} className="flex items-center text-[14px] font-semibold text-teal">
            {l.owner.display_name || l.owner.handle}의 ‘{l.title}’ 열기 <span className="ml-auto">›</span>
          </Link>
        ) : null;
      },
    };
  }, [rows]);
  useMapScene(scene);

  if (!rows) return <PanelLoading />;

  return (
    <Panel title={tab === "following" ? `팔로잉 리스트 · ${rows.length}개` : `좋아요한 리스트 · ${rows.length}개`}>
      <div className="px-5 pb-8 pt-4">
        <div className="mb-3 flex gap-1.5" role="tablist">
          {(["following", "liked"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`rounded-full px-3 py-1.5 text-[13px] font-semibold ${tab === t ? "bg-ink text-white" : "bg-surface text-ink"}`}
            >
              {t === "following" ? "팔로잉" : `좋아요${liked.length ? ` ${liked.length}` : ""}`}
            </button>
          ))}
        </div>
        {rows.length === 0 ? (
          <div className="py-6 text-[15px] text-muted">
            {tab === "liked"
              ? "아직 좋아요한 리스트가 없어요."
              : people === 0
                ? "아직 팔로우한 사람이 없어요."
                : "팔로우한 사람들이 아직 공개 리스트를 만들지 않았어요."}
            <Link href="/explore" className="btn-primary mt-4">타인의 핀 둘러보기</Link>
          </div>
        ) : (
          <>
            <p className="text-[13px] text-muted">
              {tab === "following"
                ? `팔로우하는 ${people}명의 리스트를 최근에 바뀐 순서로 보여줘요. 지도에는 모든 핀이 함께 보입니다.`
                : "좋아요를 누른 리스트예요. 지도에는 모든 핀이 함께 보입니다."}
            </p>
            <ul className="mt-3 divide-y divide-rule border-y border-rule">
              {rows.map((l) => (
                <li key={l.id}>
                  <Link href={`/@${l.owner?.handle}/${l.slug}${tab === "liked" ? "?from=liked" : ""}`} className="block py-3.5 hover:bg-surface/60">
                    <span className="block text-[17px] font-semibold text-ink">{l.title}</span>
                    <span className="mt-1 block text-[13px] text-muted">
                      {l.owner?.display_name || `@${l.owner?.handle}`} · 장소 {l.list_items.length}곳 · {ago(l.updated_at)}
                      {l.like_count > 0 && ` · 좋아요 ${l.like_count.toLocaleString("ko-KR")}`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Panel>
  );
}
