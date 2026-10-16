"use client";

import Link from "next/link";
import { Panel } from "./shell/Panel";
import { AdSlot } from "./AdSlot";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useShell } from "./shell/context";

// 이 확대 단계(도시 정도)보다 넓게 보고 있으면 '이 지역'으로 치지 않는다
const LOCAL_ZOOM = 8;

type CuratorHit = { id: string; handle: string; display_name: string; bio: string };
type ListHit = {
  id: string;
  slug: string;
  title: string;
  themes: string[];
  like_count: number;
  owner_id: string;
  // 내 리스트와 겹치는 장소 수(추천용)
  overlap?: number;
  owner: { handle: string; display_name: string } | null;
  list_items: { count: number }[];
};

const LIST_SELECT =
  "id, slug, title, themes, like_count, owner_id, owner:profiles!lists_owner_id_fkey(handle, display_name), list_items(count)";

// 검색어를 PostgREST 필터에 안전하게 넣기 위해 특수문자를 뺀다.
const clean = (q: string) => q.replace(/[,()%*\\#]/g, " ").trim();

// /explore — 다른 사람의 리스트와 큐레이터 찾기
export function ExploreView() {
  const supabase = useMemo(() => createClient(), []);
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState<string | null>(null);
  const [curators, setCurators] = useState<CuratorHit[]>([]);
  const [lists, setLists] = useState<ListHit[]>([]);
  const [following, setFollowing] = useState<CuratorHit[]>([]);
  const [recent, setRecent] = useState<ListHit[]>([]);
  const [popular, setPopular] = useState<ListHit[]>([]);
  const [similar, setSimilar] = useState<ListHit[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // 지금 지도에 보이는 지역에 핀이 있는 리스트(핀 수)
  const { view } = useShell();
  const [nearby, setNearby] = useState<ListHit[]>([]);
  const [pinsHere, setPinsHere] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    if (!view || view.zoom < LOCAL_ZOOM) {
      const t0 = window.setTimeout(() => {
        setNearby([]);
        setPinsHere(new Map());
      }, 0);
      return () => window.clearTimeout(t0);
    }
    // 지도를 움직이는 동안은 기다렸다가 멈추면 한 번만 찾는다
    const t = window.setTimeout(async () => {
      const { data } = await supabase.rpc("lists_in_view", { p_s: view.s, p_w: view.w, p_n: view.n, p_e: view.e, p_limit: 30 });
      const rows = (data ?? []) as { list_id: string; pins: number }[];
      const pins = new Map(rows.map((r) => [r.list_id, r.pins]));
      setPinsHere(pins);
      if (rows.length === 0) return setNearby([]);
      const { data: ls } = await supabase.from("lists").select(LIST_SELECT).in("id", rows.map((r) => r.list_id));
      const { data: auth } = await supabase.auth.getSession();
      const uid = auth.session?.user.id;
      setNearby(
        ((ls ?? []) as unknown as ListHit[])
          .filter((l) => l.owner_id !== uid)
          .sort((a, b) => (pins.get(b.id) ?? 0) - (pins.get(a.id) ?? 0) || b.like_count - a.like_count),
      );
    }, 500);
    return () => window.clearTimeout(t);
  }, [supabase, view]);

  // 다른 묶음에서도 이 지역에 핀이 있는 리스트를 앞으로(그 안에서는 원래 순서)
  const localFirst = useCallback(
    (rows: ListHit[]) =>
      pinsHere.size === 0 ? rows : [...rows].sort((a, b) => Number(pinsHere.has(b.id)) - Number(pinsHere.has(a.id))),
    [pinsHere],
  );

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id ?? null;
      setMe(uid);
      const notMine = (l: ListHit) => l.owner_id !== uid && (l.list_items[0]?.count ?? 0) > 0;

      // 새로 올라온 리스트, 인기 리스트(좋아요 순)는 함께 읽는다
      const [{ data: r }, { data: pop }] = await Promise.all([
        supabase.from("lists").select(LIST_SELECT).eq("visibility", "public").order("updated_at", { ascending: false }).limit(30),
        supabase.from("lists").select(LIST_SELECT).eq("visibility", "public").gt("like_count", 0).order("like_count", { ascending: false }).limit(20),
      ]);
      setRecent(((r ?? []) as unknown as ListHit[]).filter(notMine));
      setPopular(((pop ?? []) as unknown as ListHit[]).filter(notMine).slice(0, 10));

      if (!uid) return;
      const [{ data: f }, { data: mine }] = await Promise.all([
        supabase
          .from("follows")
          .select("followee:profiles!follows_followee_id_fkey(id, handle, display_name, bio)")
          .eq("follower_id", uid)
          .order("created_at", { ascending: false }),
        // 내 리스트에 담긴 장소들
        supabase.from("list_items").select("place_id, lists!inner(owner_id)").eq("lists.owner_id", uid).limit(300),
      ]);
      setFollowing(((f ?? []) as unknown as { followee: CuratorHit }[]).map((x) => x.followee).filter(Boolean));

      // 내 장소가 많이 겹치는 다른 사람의 공개 리스트
      const placeIds = [...new Set((mine ?? []).map((x) => x.place_id as string))];
      if (placeIds.length === 0) return;
      const { data: hits } = await supabase
        .from("list_items")
        .select("list_id, place_id, lists!inner(owner_id, visibility)")
        .in("place_id", placeIds.slice(0, 150))
        .eq("lists.visibility", "public")
        .neq("lists.owner_id", uid)
        .limit(1000);
      const overlap = new Map<string, Set<string>>();
      for (const h of (hits ?? []) as { list_id: string; place_id: string }[]) {
        if (!overlap.has(h.list_id)) overlap.set(h.list_id, new Set());
        overlap.get(h.list_id)!.add(h.place_id);
      }
      const top = [...overlap.entries()].sort((a, b) => b[1].size - a[1].size).slice(0, 10);
      if (top.length === 0) return;
      const { data: sim } = await supabase.from("lists").select(LIST_SELECT).in("id", top.map(([id]) => id));
      const byId = new Map(((sim ?? []) as unknown as ListHit[]).map((l) => [l.id, l]));
      setSimilar(
        top.flatMap(([id, set]): ListHit[] => {
          const l = byId.get(id);
          return l ? [{ ...l, overlap: set.size }] : [];
        }),
      );
    })();
  }, [supabase]);

  const search = useCallback(
    async (raw: string) => {
      const q = clean(raw);
      if (!q) {
        setSearched(null);
        return;
      }
      setLoading(true);
      const theme = q.replace(/^#/, "");
      const [{ data: c }, { data: l }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, handle, display_name, bio")
          .or(`handle.ilike.%${q.replace(/^@/, "")}%,display_name.ilike.%${q}%`)
          .limit(10),
        supabase
          .from("lists")
          .select(LIST_SELECT)
          .eq("visibility", "public")
          .or(`title.ilike.%${q}%,description.ilike.%${q}%,themes.cs.{${theme}}`)
          .order("like_count", { ascending: false })
          .limit(30),
      ]);
      setCurators((c ?? []).filter((x) => x.id !== me));
      setLists((l ?? []) as unknown as ListHit[]);
      setSearched(q);
      setLoading(false);
    },
    [supabase, me],
  );

  return (
    <Panel title="타인의 핀">
      <div className="px-5 pb-10 pt-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          search(query);
        }}
        className="flex gap-2"
        role="search"
      >
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!e.target.value) setSearched(null);
          }}
          placeholder="사람 이름, @핸들, 리스트 제목, #테마"
          aria-label="검색어"
          className="field"
          enterKeyHint="search"
        />
        <button type="submit" className="btn-primary shrink-0">검색</button>
      </form>

      {loading && <p className="mt-6 text-[14px] text-muted">찾는 중</p>}

      {searched !== null && !loading && (
        <>
          <Section title={`사람 ${curators.length}`}>
            {curators.length === 0 ? <Empty>‘{searched}’와 맞는 사람이 없습니다.</Empty> : <CuratorRows rows={curators} />}
          </Section>
          <Section title={`리스트 ${lists.length}`}>
            {lists.length === 0 ? <Empty>‘{searched}’와 맞는 공개 리스트가 없습니다.</Empty> : <ListRows rows={localFirst(lists)} pinsHere={pinsHere} />}
          </Section>
        </>
      )}

      {searched === null && (
        <>
          {nearby.length > 0 && (
            <Section title="지금 지도에 보이는 지역의 리스트">
              <ListRows rows={nearby} pinsHere={pinsHere} />
            </Section>
          )}
          {view && view.zoom < LOCAL_ZOOM && (
            <p className="mt-6 rounded-xl bg-surface px-3 py-2 text-[13px] text-muted">지도를 도시 정도로 확대하면 그 지역에 핀을 꽂은 리스트를 먼저 보여 드려요.</p>
          )}
          {following.length > 0 && (
            <Section title="팔로우 중">
              <CuratorRows rows={following} />
            </Section>
          )}
          {similar.length > 0 && (
            <Section title="내 리스트와 겹치는 리스트">
              <ListRows rows={localFirst(similar)} pinsHere={pinsHere} />
            </Section>
          )}
          {popular.length > 0 && (
            <Section title="인기 리스트">
              <ListRows rows={localFirst(popular)} adSlot="explore-popular" pinsHere={pinsHere} />
            </Section>
          )}
          <div className="-mx-5 mt-6">
            <AdSlot slot="explore-mid" variant={2} />
          </div>
          <Section title="새로 올라온 리스트">
            {recent.length === 0 ? <Empty>아직 공개된 리스트가 없습니다.</Empty> : <ListRows rows={localFirst(recent)} adSlot="explore-recent" pinsHere={pinsHere} />}
          </Section>
          <Section title="예시">
            <Link href="/demo" className="block border-y border-rule py-3.5 hover:bg-surface/60">
              <span className="block text-[17px] font-semibold text-ink">성수동 하루, 걸어서 도는 일곱 군데</span>
              <span className="mt-1 block text-[13px] text-muted">민지의 걷는 서울 · 장소 7곳 · #서울 #성수 #하루코스</span>
            </Link>
          </Section>
        </>
      )}
      </div>
    </Panel>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-[15px] font-semibold text-teal">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-3 text-[15px] text-muted">{children}</p>;
}

function CuratorRows({ rows }: { rows: CuratorHit[] }) {
  return (
    <ul className="divide-y divide-rule border-y border-rule">
      {rows.map((c) => (
        <li key={c.id}>
          <Link href={`/@${c.handle}`} className="flex items-center gap-3 py-3 hover:bg-surface/60">
            <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-teal text-[15px] font-semibold text-white">
              {(c.display_name || c.handle).slice(0, 1)}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[16px] font-semibold text-ink">{c.display_name || c.handle}</span>
              <span className="block truncate text-[13px] text-muted">@{c.handle}{c.bio && ` · ${c.bio}`}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

// 광고 자리: 리스트 5개마다
function ListRows({ rows, adSlot, pinsHere }: { rows: ListHit[]; adSlot?: string; pinsHere?: Map<string, number> }) {
  return (
    <ul className="divide-y divide-rule border-y border-rule">
      {rows.map((l, i) => (
        <li key={l.id}>
          {adSlot && i > 0 && i % 5 === 0 && (
            <div className="-mx-5 py-1">
              <AdSlot slot={adSlot} variant={i / 5} />
            </div>
          )}
          <Link href={`/@${l.owner?.handle}/${l.slug}`} className="block py-3.5 hover:bg-surface/60">
            <span className="block text-[17px] font-semibold text-ink">{l.title}</span>
            <span className="mt-1 block text-[13px] text-muted">
              {l.owner?.display_name || `@${l.owner?.handle}`} · 장소 {l.list_items[0]?.count ?? 0}곳
              {l.overlap ? ` · 내 장소와 ${l.overlap}곳 겹침` : ""}
              {pinsHere?.get(l.id) ? ` · 이 지역 ${pinsHere.get(l.id)}곳` : ""}
              {l.like_count > 0 && ` · 좋아요 ${l.like_count.toLocaleString("ko-KR")}`}
              {l.themes.length > 0 && ` · ${l.themes.map((t) => `#${t}`).join(" ")}`}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
