"use client";

import Link from "next/link";
import { OfficialBadge } from "./OfficialBadge";
import { ExampleBadge } from "./ExampleBadge";
import { useExampleLists } from "@/lib/examples";
import { Panel } from "./shell/Panel";
import { AdSlot } from "./AdSlot";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useShell } from "./shell/context";
import { LANGS } from "@/lib/i18n/core";
import { useFormat, useLang, useT } from "@/lib/i18n/client";
import { listLang, useExploreLangs } from "@/lib/exploreLangs";

// 이 확대 단계(도시 정도)보다 넓게 보고 있으면 '이 지역'으로 치지 않는다
const LOCAL_ZOOM = 8;

type CuratorHit = { id: string; handle: string; display_name: string; bio: string; is_official?: boolean };
type ListHit = {
  id: string;
  slug: string;
  title: string;
  themes: string[];
  like_count: number;
  owner_id: string;
  // 운영팀이 만든 예시 리스트
  is_example?: boolean;
  // 운영팀·예시 리스트의 언어(다른 언어의 공식 리스트는 '타인의 핀' 목록에서 뺀다). 사용자 리스트는 비어 있음
  lang?: string | null;
  // 내 리스트와 겹치는 장소 수(추천용)
  overlap?: number;
  owner: { handle: string; display_name: string; is_official?: boolean; lang?: string | null } | null;
  list_items: { count: number }[];
};

const LIST_SELECT =
  "id, slug, title, themes, like_count, owner_id, is_example, lang, owner:profiles!lists_owner_id_fkey(handle, display_name, is_official, lang), list_items(count)";

// 검색어를 PostgREST 필터에 안전하게 넣기 위해 특수문자를 뺀다.
const clean = (q: string) => q.replace(/[,()%*\\#]/g, " ").trim();

type Category = "following" | "popular" | "similar";
const CATEGORIES: { id: Category; label: string; login?: boolean }[] = [
  { id: "following", label: "팔로우 중@@칩", login: true },
  { id: "popular", label: "인기 리스트@@칩" },
  { id: "similar", label: "내 리스트와 겹치는 리스트@@칩", login: true },
];
const PREF = "pw_explore";

function readPref(): { cat?: Category; local?: boolean } {
  try {
    return JSON.parse(localStorage.getItem(PREF) ?? "{}");
  } catch {
    return {};
  }
}

// /explore — 다른 사람의 리스트와 큐레이터 찾기.
// 위에서 묶음(팔로우 중 · 인기 · 내 리스트와 겹치는)을 골라 그 리스트만 보여 주고,
// '현재 지도 지역 먼저'를 켜면 그 묶음 안에서 지금 지도에 핀이 있는 리스트를 위로 올린다.
export function ExploreView() {
  const t = useT();
  const ui = useLang();
  // '타인의 핀' 목록은 My에서 고른 언어(없으면 화면 언어)의 리스트만. 검색 결과는 언어와 관계없이 모두.
  const { langs } = useExploreLangs();
  const langOk = useCallback((l: ListHit) => langs.includes(listLang(l) as never), [langs]);
  const supabase = useMemo(() => createClient(), []);
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState<string | null>(null);
  const [curators, setCurators] = useState<CuratorHit[]>([]);
  const [lists, setLists] = useState<ListHit[]>([]);
  const [following, setFollowing] = useState<CuratorHit[]>([]);
  const [followingLists, setFollowingLists] = useState<ListHit[]>([]);
  const [popular, setPopular] = useState<ListHit[]>([]);
  const [similar, setSimilar] = useState<ListHit[]>([]);
  // undefined: 아직 확인 중
  const [me, setMe] = useState<string | null | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [cat, setCat] = useState<Category | null>(null);
  const [local, setLocal] = useState(true);
  // 지금 지도에 보이는 지역에 핀이 있는 리스트(핀 수)
  const { view } = useShell();
  const [nearby, setNearby] = useState<ListHit[]>([]);
  const [pinsHere, setPinsHere] = useState<Map<string, number>>(new Map());

  // 고른 묶음·켜기 상태는 이 기기에 기억한다
  useEffect(() => {
    const p = readPref();
    const timer = window.setTimeout(() => {
      if (p.cat) setCat(p.cat);
      if (typeof p.local === "boolean") setLocal(p.local);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  const choose = (next: { cat?: Category; local?: boolean }) => {
    if (next.cat) setCat(next.cat);
    if (typeof next.local === "boolean") setLocal(next.local);
    try {
      localStorage.setItem(PREF, JSON.stringify({ ...readPref(), ...next }));
    } catch {
      /* 저장이 막힌 브라우저 */
    }
  };

  useEffect(() => {
    if (!local || !view || view.zoom < LOCAL_ZOOM) {
      const t0 = window.setTimeout(() => {
        setNearby([]);
        setPinsHere(new Map());
      }, 0);
      return () => window.clearTimeout(t0);
    }
    // 지도를 움직이는 동안은 기다렸다가 멈추면 한 번만 찾는다
    const timer = window.setTimeout(async () => {
      const { data } = await supabase.rpc("lists_in_view", { p_s: view.s, p_w: view.w, p_n: view.n, p_e: view.e, p_limit: 60 });
      const rows = (data ?? []) as { list_id: string; pins: number }[];
      const pins = new Map(rows.map((r) => [r.list_id, r.pins]));
      setPinsHere(pins);
      if (rows.length === 0) return setNearby([]);
      const { data: ls } = await supabase.from("lists").select(LIST_SELECT).in("id", rows.map((r) => r.list_id));
      setNearby((ls ?? []) as unknown as ListHit[]);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [supabase, view, local]);

  // 켜져 있으면 이 지역에 핀이 있는 리스트를 위로(핀 많은 순), 나머지는 원래 순서
  const localFirst = useCallback(
    (rows: ListHit[]) =>
      !local || pinsHere.size === 0
        ? rows
        : [...rows].sort((a, b) => (pinsHere.get(b.id) ?? 0) - (pinsHere.get(a.id) ?? 0)),
    [pinsHere, local],
  );

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id ?? null;
      setMe(uid);
      const notMine = (l: ListHit) => l.owner_id !== uid && (l.list_items?.[0]?.count ?? 0) > 0;

      const { data: pop } = await supabase
        .from("lists").select(LIST_SELECT).eq("visibility", "public")
        .order("like_count", { ascending: false }).order("updated_at", { ascending: false }).limit(80);
      setPopular(((pop ?? []) as unknown as ListHit[]).filter(notMine).slice(0, 80));

      if (!uid) return;
      const [{ data: f }, { data: mine }] = await Promise.all([
        supabase
          .from("follows")
          .select("followee:profiles!follows_followee_id_fkey(id, handle, display_name, bio, is_official)")
          .eq("follower_id", uid)
          .order("created_at", { ascending: false }),
        // 내 리스트에 담긴 장소들
        supabase.from("list_items").select("place_id, lists!inner(owner_id)").eq("lists.owner_id", uid).limit(300),
      ]);
      const people = ((f ?? []) as unknown as { followee: CuratorHit }[]).map((x) => x.followee).filter(Boolean);
      setFollowing(people);
      if (people.length) {
        const { data: fl } = await supabase
          .from("lists").select(LIST_SELECT).eq("visibility", "public").in("owner_id", people.map((p) => p.id))
          .order("updated_at", { ascending: false }).limit(60);
        setFollowingLists(((fl ?? []) as unknown as ListHit[]).filter(notMine));
      }

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
      const top = [...overlap.entries()].sort((a, b) => b[1].size - a[1].size).slice(0, 20);
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
          .select("id, handle, display_name, bio, is_official")
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

  // 로그인하지 않았으면 '인기'만. 고른 적이 없으면 팔로우한 사람이 있을 때 '팔로우 중', 아니면 '인기'.
  const active: Category = !me ? "popular" : cat ?? (following.length ? "following" : "popular");
  // 지금 지역에 핀이 있는데 처음 목록 밖에 있던 리스트도 그 묶음 조건에 맞으면 넣는다
  const base: ListHit[] = useMemo(() => {
    const merge = (rows: ListHit[], extra: ListHit[]) => {
      const seen = new Set(rows.map((r) => r.id));
      return [...rows, ...extra.filter((x) => !seen.has(x.id))];
    };
    const followIds = new Set(following.map((p) => p.id));
    const rows =
      active === "following" ? merge(followingLists, local ? nearby.filter((l) => followIds.has(l.owner_id) && l.owner_id !== me) : [])
      : active === "popular" ? merge(popular, local ? nearby.filter((l) => l.owner_id !== me) : []).slice(0, 60)
      : similar;
    return rows.filter(langOk);
  }, [active, followingLists, popular, similar, nearby, following, local, me, langOk]);
  const shown = localFirst(base);

  return (
    <Panel title={t("타인의 핀")}>
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
          placeholder={t("사람 이름, @핸들, 리스트 제목, #테마")}
          aria-label={t("검색어")}
          className="field"
          enterKeyHint="search"
        />
        <button type="submit" className="btn-primary shrink-0">{t("검색")}</button>
      </form>

      {!!me && searched === null && (
        <p className="mt-3 text-[12px] text-muted">
          {t("보는 언어: {langs}", { langs: langs.map((l) => LANGS.find((x) => x.id === l)?.label ?? l).join(", ") })}{" "}
          <Link href="/me#explore-langs" className="font-semibold text-teal underline">{t("바꾸기")}</Link>
        </p>
      )}
      {me === null && (
        <p className="mt-3">
          <Link href={`/places/${ui}`} className="text-[14px] font-semibold text-teal">📍 {t("도시별로 둘러보기")} ›</Link>
        </p>
      )}
      {/* 로그인 전에는 묶음 고르기 없이 예시만 */}
      {!!me && (
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label={t("리스트 묶음")} className="flex min-w-0 gap-1.5 overflow-x-auto">
          {CATEGORIES.map((c) => {
            const locked = c.login && !me;
            return (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={active === c.id && searched === null}
                disabled={!!locked}
                title={locked ? t("로그인하면 볼 수 있어요") : undefined}
                onClick={() => {
                  choose({ cat: c.id });
                  setSearched(null);
                  setQuery("");
                }}
                className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-semibold ${
                  active === c.id && searched === null ? "bg-ink text-white" : "bg-surface text-ink"
                } disabled:opacity-40`}
              >
                {t(c.label)}
              </button>
            );
          })}
          {/* 도시별 소개 페이지로(화면 언어판) */}
          <Link href={`/places/${ui}`} className="shrink-0 rounded-full bg-surface px-3 py-1.5 text-[13px] font-semibold text-ink">
            {t("도시별@@칩")} ›
          </Link>
        </div>
        <label className="ml-auto flex shrink-0 cursor-pointer items-center gap-2 text-[13px] font-semibold text-ink">
          <span>{t("현재 지도 지역 먼저")}</span>
          <button
            type="button"
            role="switch"
            aria-checked={local}
            onClick={() => choose({ local: !local })}
            className={`relative h-6 w-10 rounded-full transition-colors ${local ? "bg-teal" : "bg-rule"}`}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${local ? "left-[18px]" : "left-0.5"}`} />
          </button>
        </label>
      </div>
      )}
      {!!me && local && view && view.zoom < LOCAL_ZOOM && searched === null && (
        <p className="mt-2 text-[12px] text-muted">{t("지도를 도시 정도로 확대하면 그 지역에 핀을 꽂은 리스트를 먼저 보여 드려요.")}</p>
      )}

      {loading && <p className="mt-6 text-[14px] text-muted">{t("찾는 중")}</p>}

      {searched !== null && !loading && (
        <>
          <Section title={t("사람 {n}", { n: curators.length })}>
            {curators.length === 0 ? <Empty>{t("‘{q}’와 맞는 사람이 없습니다.", { q: searched })}</Empty> : <CuratorRows rows={curators} />}
          </Section>
          <Section title={t("리스트 {n}", { n: lists.length })}>
            {lists.length === 0 ? <Empty>{t("‘{q}’와 맞는 공개 리스트가 없습니다.", { q: searched })}</Empty> : <ListRows rows={localFirst(lists)} pinsHere={local ? pinsHere : undefined} />}
          </Section>
        </>
      )}

      {searched === null && me === null && <LoggedOutExamples />}

      {searched === null && !!me && (
        <>
          <div className="mt-4">
            {shown.length > 0 ? (
              <ListRows rows={shown} adSlot={active === "popular" ? "explore-popular" : undefined} pinsHere={local ? pinsHere : undefined} />
            ) : active === "following" ? (
              following.length === 0 ? (
                <Empty>{t("아직 팔로우한 사람이 없어요. 인기 리스트에서 마음에 드는 큐레이터를 찾아보세요.")}</Empty>
              ) : (
                <>
                  <Empty>{t("팔로우한 사람들이 아직 공개 리스트를 만들지 않았어요.")}</Empty>
                  <CuratorRows rows={following} />
                </>
              )
            ) : active === "similar" ? (
              <Empty>{t("내 리스트에 장소를 담으면, 같은 장소를 담은 다른 사람의 리스트를 보여 드려요.")}</Empty>
            ) : (
              <Empty>{t("아직 공개된 리스트가 없습니다.")}</Empty>
            )}
          </div>
          <div className="-mx-5 mt-6">
            <AdSlot slot="explore-mid" variant={2} />
          </div>
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
              <span className="flex min-w-0 items-center gap-1.5 text-[16px] font-semibold text-ink">
                <span className="truncate">{c.display_name || c.handle}</span>
                {c.is_official && <OfficialBadge />}
              </span>
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
  const t = useT();
  const { num } = useFormat();
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
            <span className="flex items-center gap-1.5 text-[17px] font-semibold text-ink">
              <span className="min-w-0">{l.title}</span>
              {pinsHere?.get(l.id) ? (
                <span
                  title={t("이 지역 {n}곳", { n: pinsHere.get(l.id) })}
                  aria-label={t("이 지역 {n}곳", { n: pinsHere.get(l.id) })}
                  className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-teal/10 px-1.5 py-0.5 text-[11px] font-semibold text-teal"
                >
                  {/* 지금 지도에 보이는 지역에 핀이 있는 리스트 */}
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden>
                    <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" />
                  </svg>
                  {pinsHere.get(l.id)}
                </span>
              ) : null}
            </span>
            <span className="mt-1 block text-[13px] text-muted">
              {l.owner?.display_name || `@${l.owner?.handle}`}
              {l.owner?.is_official && <OfficialBadge className="ml-1" />}
              {l.is_example && <ExampleBadge className="ml-1" />} · {t("장소 {n}곳", { n: l.list_items?.[0]?.count ?? 0 })}
              {l.overlap ? ` · ${t("내 장소와 {n}곳 겹침", { n: l.overlap })}` : ""}
              {l.like_count > 0 && ` · ${t("좋아요 {count}", { n: l.like_count, count: num(l.like_count) })}`}
              {l.themes.length > 0 && ` · ${l.themes.map((th) => `#${th}`).join(" ")}`}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

// 로그인 전: 언어별 예시 3개만(나머지 리스트는 로그인하면 보임)
function LoggedOutExamples() {
  const t = useT();
  const examples = useExampleLists();
  return (
    <>
      <Section title={t("예시")}>
        {examples === null ? (
          <p className="text-[14px] text-muted">{t("불러오는 중")}</p>
        ) : examples.length === 0 ? (
          <Empty>{t("아직 공개된 리스트가 없습니다.")}</Empty>
        ) : (
          <ListRows rows={examples} />
        )}
      </Section>
      <div className="mt-6 rounded-xl bg-surface px-4 py-4 text-[14px] text-ink/80">
        {t("로그인하면 더 많은 리스트를 둘러보고, 마음에 드는 큐레이터를 팔로우할 수 있어요.")}
        <Link href="/login?next=/explore" className="btn-primary mt-3 w-full justify-center">{t("로그인")}</Link>
      </div>
    </>
  );
}
