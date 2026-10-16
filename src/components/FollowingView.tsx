"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ListItem } from "@/lib/types";
import { Panel, PanelLoading } from "./shell/Panel";
import { useMapScene, type Scene } from "./shell/context";
import { tr, useFormat, useT } from "@/lib/i18n/client";

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
  return d <= 0 ? tr("오늘") : d < 7 ? tr("{n}일 전", { n: d }) : d < 30 ? tr("{n}주 전", { n: Math.floor(d / 7) }) : tr("{n}달 전", { n: Math.floor(d / 30) });
};

// /following — 내가 팔로우하는 사람들의 공개 리스트. 지도에는 그 리스트들의 핀을 모두 보여준다.
export function FollowingView() {
  const router = useRouter();
  const t = useT();
  const { num } = useFormat();
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
          <OpenListLink href={`/@${l.owner.handle}/${l.slug}`} owner={l.owner.display_name || l.owner.handle} title={l.title} />
        ) : null;
      },
    };
  }, [rows]);
  useMapScene(scene);

  if (!rows) return <PanelLoading />;

  return (
    <Panel title={tab === "following" ? t("팔로잉 리스트 · {n}개", { n: rows.length }) : t("좋아요한 리스트 · {n}개", { n: rows.length })}>
      <div className="px-5 pb-8 pt-4">
        <div className="mb-3 flex gap-1.5" role="tablist">
          {(["following", "liked"] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={`rounded-full px-3 py-1.5 text-[13px] font-semibold ${tab === k ? "bg-ink text-white" : "bg-surface text-ink"}`}
            >
              {k === "following" ? t("팔로잉") : `${t("좋아요@@탭")}${liked.length ? ` ${liked.length}` : ""}`}
            </button>
          ))}
        </div>
        {rows.length === 0 ? (
          <div className="py-6 text-[15px] text-muted">
            {tab === "liked"
              ? t("아직 좋아요한 리스트가 없어요.")
              : people === 0
                ? t("아직 팔로우한 사람이 없어요.")
                : t("팔로우한 사람들이 아직 공개 리스트를 만들지 않았어요.")}
            <Link href="/explore" className="btn-primary mt-4">{t("타인의 핀 둘러보기")}</Link>
          </div>
        ) : (
          <>
            <p className="text-[13px] text-muted">
              {tab === "following"
                ? t("팔로우하는 {n}명의 리스트를 최근에 바뀐 순서로 보여줘요. 지도에는 모든 핀이 함께 보입니다.", { n: people })
                : t("좋아요를 누른 리스트예요. 지도에는 모든 핀이 함께 보입니다.")}
            </p>
            <ul className="mt-3 divide-y divide-rule border-y border-rule">
              {rows.map((l) => (
                <li key={l.id}>
                  <Link href={`/@${l.owner?.handle}/${l.slug}${tab === "liked" ? "?from=liked" : ""}`} className="block py-3.5 hover:bg-surface/60">
                    <span className="block text-[17px] font-semibold text-ink">{l.title}</span>
                    <span className="mt-1 block text-[13px] text-muted">
                      {l.owner?.display_name || `@${l.owner?.handle}`} · {t("장소 {n}곳", { n: l.list_items.length })} · {ago(l.updated_at)}
                      {l.like_count > 0 && ` · ${t("좋아요 {count}", { n: l.like_count, count: num(l.like_count) })}`}
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

// 지도 핀 카드 아래: 그 핀이 든 리스트 열기(지도 장면을 다시 만들지 않도록 번역은 여기서)
function OpenListLink({ href, owner, title }: { href: string; owner: string; title: string }) {
  const t = useT();
  return (
    <Link href={href} className="flex items-center text-[14px] font-semibold text-teal">
      {t("{owner}의 ‘{title}’ 열기", { owner, title })} <span className="ml-auto">›</span>
    </Link>
  );
}
