"use client";

import Link from "next/link";
import { Panel } from "./shell/Panel";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type CuratorHit = { id: string; handle: string; display_name: string; bio: string };
type ListHit = {
  id: string;
  slug: string;
  title: string;
  themes: string[];
  like_count: number;
  owner: { handle: string; display_name: string } | null;
  list_items: { count: number }[];
};

const LIST_SELECT =
  "id, slug, title, themes, like_count, owner:profiles!lists_owner_id_fkey(handle, display_name), list_items(count)";

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
  const [me, setMe] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id ?? null;
      setMe(uid);
      const recentReq = supabase
        .from("lists")
        .select(LIST_SELECT)
        .eq("visibility", "public")
        .order("updated_at", { ascending: false })
        .limit(30);
      if (uid) {
        const { data: f } = await supabase
          .from("follows")
          .select("followee:profiles!follows_followee_id_fkey(id, handle, display_name, bio)")
          .eq("follower_id", uid)
          .order("created_at", { ascending: false });
        setFollowing(((f ?? []) as unknown as { followee: CuratorHit }[]).map((r) => r.followee).filter(Boolean));
      }
      const { data: r } = await recentReq;
      setRecent(((r ?? []) as unknown as ListHit[]).filter((l) => (l.list_items[0]?.count ?? 0) > 0));
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
    <Panel title="찾기 · 큐레이터와 리스트">
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
            {lists.length === 0 ? <Empty>‘{searched}’와 맞는 공개 리스트가 없습니다.</Empty> : <ListRows rows={lists} />}
          </Section>
        </>
      )}

      {searched === null && (
        <>
          {following.length > 0 && (
            <Section title="팔로우 중">
              <CuratorRows rows={following} />
            </Section>
          )}
          <Section title="새로 올라온 리스트">
            {recent.length === 0 ? <Empty>아직 공개된 리스트가 없습니다.</Empty> : <ListRows rows={recent} />}
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

function ListRows({ rows }: { rows: ListHit[] }) {
  return (
    <ul className="divide-y divide-rule border-y border-rule">
      {rows.map((l) => (
        <li key={l.id}>
          <Link href={`/@${l.owner?.handle}/${l.slug}`} className="block py-3.5 hover:bg-surface/60">
            <span className="block text-[17px] font-semibold text-ink">{l.title}</span>
            <span className="mt-1 block text-[13px] text-muted">
              {l.owner?.display_name || `@${l.owner?.handle}`} · 장소 {l.list_items[0]?.count ?? 0}곳
              {l.like_count > 0 && ` · 좋아요 ${l.like_count.toLocaleString("ko-KR")}`}
              {l.themes.length > 0 && ` · ${l.themes.map((t) => `#${t}`).join(" ")}`}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
