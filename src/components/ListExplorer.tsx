"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { CuratedList, ListItem } from "@/lib/types";
import {
  googleDirectionsUrl,
  googleMapsUrl,
  isInKorea,
  isWithinMeters,
  kakaoMapUrl,
  naverMapUrl,
} from "@/lib/links";
import { track } from "@/lib/track";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/client";
import { FollowButton } from "./FollowButton";
import { SaveToListSheet } from "./SaveToListSheet";
import { useRouter } from "next/navigation";

const PlaceMap = dynamic(() => import("./PlaceMap").then((m) => m.PlaceMap), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-surface" />,
});

type View = "map" | "list";
type Sort = "curator" | "nearest";

const formatCount = (n: number) =>
  n >= 10000 ? `${(n / 10000).toFixed(1).replace(/\.0$/, "")}만` : n.toLocaleString("ko-KR");

export function ListExplorer({ list }: { list: CuratedList }) {
  const [view, setView] = useState<View>("map");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // 섹션 필터: "all" 또는 섹션 id. 지도 핀과 목록이 함께 바뀐다.
  const [section, setSection] = useState<string>("all");
  const [saving, setSaving] = useState<ListItem | null>(null);
  const router = useRouter();
  const [sort, setSort] = useState<Sort>("curator");
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const isDemo = list.id.startsWith("demo");
  const homeHref = isDemo ? "/" : `/@${list.curator.handle}`;

  // 주인이면 편집 버튼을 보여준다(권한 판단은 DB가 하고, 여기서는 버튼 노출만).
  useEffect(() => {
    if (isDemo || !isSupabaseConfigured()) return;
    createClient()
      .auth.getUser()
      .then(({ data }) => setIsOwner(data.user?.id === list.curator.id));
  }, [isDemo, list.curator.id]);

  const hasLoose = list.items.some((i) => !i.sectionId || !list.sections.some((sec) => sec.id === i.sectionId));
  const visibleItems = useMemo(() => {
    if (section === "all") return list.items;
    if (section === "none")
      return list.items.filter((i) => !i.sectionId || !list.sections.some((sec) => sec.id === i.sectionId));
    return list.items.filter((i) => i.sectionId === section);
  }, [list, section]);
  const selected = visibleItems.find((i) => i.id === selectedId) ?? null;
  const isCourse = list.kind === "course";

  const groups = useMemo(() => {
    if (sort === "nearest" && here) {
      const dist = (i: ListItem) =>
        i.lat == null || i.lng == null
          ? Infinity
          : Math.hypot(i.lat - here.lat, (i.lng - here.lng) * Math.cos((here.lat * Math.PI) / 180));
      return [{ id: "near", name: "가까운 순", items: [...visibleItems].sort((a, b) => dist(a) - dist(b)) }];
    }
    const bySection = list.sections.map((s) => ({
      id: s.id,
      name: s.name,
      items: visibleItems.filter((i) => i.sectionId === s.id),
    }));
    const loose = visibleItems.filter((i) => !i.sectionId || !list.sections.some((s) => s.id === i.sectionId));
    return [...(loose.length ? [{ id: "none", name: "", items: loose }] : []), ...bySection].filter(
      (g) => g.items.length > 0,
    );
  }, [list, visibleItems, sort, here]);

  function chooseSort(next: Sort) {
    if (next === "curator") return setSort("curator");
    if (!("geolocation" in navigator)) return setNotice("이 기기에서는 위치를 확인할 수 없습니다.");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setHere({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setSort("nearest");
      },
      () => setNotice("위치 권한이 없어 큐레이터 순서로 보여줍니다."),
      { timeout: 5000 },
    );
  }

  function select(id: string) {
    setSelectedId(id);
    const item = list.items.find((i) => i.id === id);
    track("tap", { listId: list.id, itemId: id, lat: item?.lat, lng: item?.lng });
  }

  async function startSave(item: ListItem) {
    if (isDemo) {
      setNotice("예시 리스트의 장소는 담을 수 없습니다. 실제 리스트에서 담아보세요.");
      return;
    }
    const { data } = await createClient().auth.getUser();
    if (!data.user) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    setSaving(item);
  }

  function chooseSection(id: string) {
    setSection(id);
    setSelectedId(null);
  }

  const sectionChips =
    list.sections.length > 0 ? (
      <div className="flex gap-1.5 overflow-x-auto" role="group" aria-label="섹션">
        {[{ id: "all", name: "전체" }, ...list.sections, ...(hasLoose ? [{ id: "none", name: "기타" }] : [])].map((sec) => (
          <button
            key={sec.id}
            type="button"
            aria-pressed={section === sec.id}
            onClick={() => chooseSection(sec.id)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors ${
              section === sec.id ? "bg-ink text-white" : "bg-white text-ink shadow-[inset_0_0_0_1px_var(--color-rule)]"
            }`}
          >
            {sec.name}
          </button>
        ))}
      </div>
    ) : null;

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: list.title, url });
      else {
        await navigator.clipboard.writeText(url);
        setNotice("링크를 복사했습니다.");
      }
    } catch {
      /* 사용자가 공유를 취소함 */
    }
  }

  return (
    <div className="flex h-dvh flex-col lg:flex-row">
      {/* 목록 패널: 모바일에서는 '목록' 보기일 때, 데스크톱에서는 항상 */}
      <aside
        className={`${view === "list" ? "flex" : "hidden"} min-h-0 flex-1 flex-col overflow-y-auto bg-white lg:flex lg:w-[420px] lg:flex-none lg:border-r lg:border-rule`}
      >
        <header className="px-5 pb-6 pt-4">
          <nav className="mb-5 flex items-center gap-3 text-[14px]">
            <Link href={homeHref} className="text-muted hover:text-ink">
              ← {isDemo ? "처음으로" : `${list.curator.displayName}의 지도`}
            </Link>
            <Link href="/" className="font-display ml-auto font-semibold text-pin">PinWith</Link>
            {isOwner && (
              <Link href={`/me/lists/${list.id}`} className="btn-quiet !py-1.5">편집</Link>
            )}
          </nav>
          <Link href={`/@${list.curator.handle}`} className="flex items-center gap-3 rounded-md">
            <Avatar name={list.curator.displayName} url={list.curator.avatarUrl} />
            <span className="leading-tight">
              <span className="block text-[15px] font-semibold text-ink">{list.curator.displayName}</span>
              <span className="block text-[13px] text-muted">
                @{list.curator.handle} · 팔로워 {formatCount(list.curator.followerCount)}
              </span>
            </span>
          </Link>
          <h1 className="font-display mt-6 text-[34px] font-semibold leading-[1.12] tracking-[-0.02em] text-ink text-balance">
            {list.title}
          </h1>
          {list.description && <p className="mt-3 text-[15px] leading-relaxed text-ink/80">{list.description}</p>}
          {list.themes.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="테마">
              {list.themes.map((t) => (
                <li key={t} className="rounded-full bg-surface px-2.5 py-1 text-[13px] text-teal">
                  #{t}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-5 flex gap-2">
            {isDemo ? (
              <Link href="/login" className="btn-primary">팔로우</Link>
            ) : (
              <FollowButton curatorId={list.curator.id} handle={list.curator.handle} />
            )}
            <button type="button" onClick={share} className="btn-quiet">
              공유
            </button>
            <span className="ml-auto self-center text-[13px] text-muted">좋아요 {formatCount(list.likeCount)}</span>
          </div>
        </header>

        <div className="flex items-center justify-between border-y border-rule px-5 py-2.5">
          <span className="text-[13px] text-muted">장소 {visibleItems.length}곳</span>
          <label className="flex items-center gap-2 text-[13px] text-muted">
            정렬
            <select
              value={sort}
              onChange={(e) => chooseSort(e.target.value as Sort)}
              className="rounded-md border border-rule bg-white px-2 py-1 text-ink"
            >
              <option value="curator">{isCourse ? "코스 순서" : "큐레이터 순서"}</option>
              <option value="nearest">가까운 순</option>
            </select>
          </label>
        </div>
        {sectionChips && <div className="border-b border-rule px-5 py-2.5">{sectionChips}</div>}

        <div className="pb-28 lg:pb-8">
          {groups.map((g) => (
            <section key={g.id} aria-label={g.name || "장소"}>
              {g.name && <h2 className="px-5 pb-1 pt-5 text-[13px] font-semibold text-teal">{g.name}</h2>}
              <ul>
                {g.items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => select(item.id)}
                      aria-expanded={item.id === selectedId}
                      className={`w-full px-5 py-3.5 text-left transition-colors hover:bg-surface/60 focus-visible:bg-surface ${item.id === selectedId ? "bg-surface" : ""}`}
                    >
                      <span className="flex items-baseline gap-2">
                        {isCourse && sort === "curator" && (
                          <span className="text-[13px] font-semibold tabular-nums text-pin">
                            {list.items.indexOf(item) + 1}
                          </span>
                        )}
                        <span className="text-[16px] font-semibold text-ink">{item.title}</span>
                        {here && item.lat != null && isWithinMeters(here, { lat: item.lat, lng: item.lng! }) && (
                          <span className="text-[12px] text-teal">근처</span>
                        )}
                      </span>
                      {item.memo && (
                        <span className="mt-1 block text-[14px] leading-relaxed text-ink/75">{item.memo}</span>
                      )}
                    </button>
                    {item.id === selectedId && (
                      <div className="bg-surface px-5 pb-4">
                        <PlaceActions item={item} listId={list.id} onSave={startSave} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </aside>

      {/* 지도: 모바일에서는 '지도' 보기일 때, 데스크톱에서는 항상 */}
      <main className={`${view === "map" ? "block" : "hidden"} map-ctrl-low relative min-h-0 flex-1 lg:block`}>
        <div className="absolute inset-x-0 top-0 z-10 flex items-center gap-2 bg-white/95 px-3 py-3 shadow-[0_1px_0_var(--color-rule)] lg:hidden">
          <Link href={homeHref} aria-label="뒤로" className="-my-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-[20px] text-ink hover:bg-surface">
            ‹
          </Link>
          <Avatar name={list.curator.displayName} url={list.curator.avatarUrl} size={28} />
          <p className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink">{list.title}</p>
          {isOwner && (
            <Link href={`/me/lists/${list.id}`} className="btn-quiet shrink-0 !px-3 !py-1">편집</Link>
          )}
        </div>
        {sectionChips && <div className="absolute inset-x-0 top-[52px] z-10 px-3 py-2 lg:hidden">{sectionChips}</div>}
        {sectionChips && <div className="absolute left-4 top-4 z-10 hidden max-w-[70%] lg:block">{sectionChips}</div>}
        <PlaceMap items={visibleItems} selectedId={selectedId} onSelect={select} showRoute={isCourse} />
        {selected && (
          <div className="absolute inset-x-3 bottom-20 z-10 rounded-xl bg-white p-4 shadow-[0_8px_30px_rgba(24,34,47,0.18)] lg:bottom-6 lg:left-6 lg:right-auto lg:w-[360px]">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-[17px] font-semibold text-ink">{selected.title}</h3>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="-m-1 rounded p-1 text-muted hover:text-ink"
                aria-label="닫기"
              >
                ✕
              </button>
            </div>
            {selected.memo && <p className="mt-1.5 text-[14px] leading-relaxed text-ink/80">{selected.memo}</p>}
            <div className="mt-3">
              <PlaceActions item={selected} listId={list.id} onSave={startSave} />
            </div>
          </div>
        )}
      </main>

      {/* 모바일 보기 전환 */}
      <div className="fixed inset-x-0 bottom-5 z-20 flex justify-center lg:hidden">
        <div role="tablist" aria-label="보기 방식" className="flex rounded-full bg-ink p-1 shadow-lg">
          {(["map", "list"] as const).map((v) => (
            <button
              key={v}
              role="tab"
              type="button"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={`rounded-full px-5 py-2 text-[14px] font-semibold transition-colors ${view === v ? "bg-white text-ink" : "text-white/80"}`}
            >
              {v === "map" ? "지도" : "목록"}
            </button>
          ))}
        </div>
      </div>

      {saving && <SaveToListSheet item={saving} onClose={() => setSaving(null)} />}

      {notice && (
        <div
          role="status"
          className="fixed inset-x-0 top-16 z-30 mx-auto w-fit rounded-full bg-ink px-4 py-2 text-[13px] text-white"
          onAnimationEnd={() => setNotice(null)}
          style={{ animation: "fade-out 3s forwards" }}
        >
          {notice}
        </div>
      )}
    </div>
  );
}

function PlaceActions({ item, listId, onSave }: { item: ListItem; listId: string; onSave: (item: ListItem) => void }) {
  const korea = isInKorea(item.lat, item.lng);
  const ctx = { listId, itemId: item.id, lat: item.lat, lng: item.lng };
  return (
    <div className="flex flex-wrap gap-2">
      <a
        href={googleDirectionsUrl(item)}
        target="_blank"
        rel="noopener"
        onClick={() => track("directions", ctx)}
        className="btn-primary"
      >
        구글 지도로 길찾기
      </a>
      <a
        href={googleMapsUrl(item)}
        target="_blank"
        rel="noopener"
        onClick={() => track("google_open", ctx)}
        className="btn-quiet"
      >
        구글 지도에서 보기
      </a>
      {korea && (
        <>
          <a href={naverMapUrl(item)} target="_blank" rel="noopener" onClick={() => track("naver_open", ctx)} className="btn-quiet">
            네이버 지도
          </a>
          <a href={kakaoMapUrl(item)} target="_blank" rel="noopener" onClick={() => track("kakao_open", ctx)} className="btn-quiet">
            카카오맵
          </a>
        </>
      )}
      <button type="button" onClick={() => onSave(item)} className="btn-quiet">
        내 리스트에 담기
      </button>
    </div>
  );
}

function Avatar({ name, url, size = 40 }: { name: string; url: string | null; size?: number }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" />;
  }
  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className="grid shrink-0 place-items-center rounded-full bg-teal text-[14px] font-semibold text-white"
    >
      {name.slice(0, 1)}
    </span>
  );
}
