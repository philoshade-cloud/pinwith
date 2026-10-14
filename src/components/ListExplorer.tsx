"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
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
  const [sort, setSort] = useState<Sort>("curator");
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const selected = list.items.find((i) => i.id === selectedId) ?? null;
  const isCourse = list.kind === "course";

  const groups = useMemo(() => {
    if (sort === "nearest" && here) {
      const dist = (i: ListItem) =>
        i.lat == null || i.lng == null
          ? Infinity
          : Math.hypot(i.lat - here.lat, (i.lng - here.lng) * Math.cos((here.lat * Math.PI) / 180));
      return [{ id: "near", name: "가까운 순", items: [...list.items].sort((a, b) => dist(a) - dist(b)) }];
    }
    const bySection = list.sections.map((s) => ({
      id: s.id,
      name: s.name,
      items: list.items.filter((i) => i.sectionId === s.id),
    }));
    const loose = list.items.filter((i) => !i.sectionId || !list.sections.some((s) => s.id === i.sectionId));
    return [...(loose.length ? [{ id: "none", name: "", items: loose }] : []), ...bySection].filter(
      (g) => g.items.length > 0,
    );
  }, [list, sort, here]);

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
        <header className="px-5 pb-6 pt-6">
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
            <Link href={`/login?next=/@${list.curator.handle}`} className="btn-primary">
              팔로우
            </Link>
            <button type="button" onClick={share} className="btn-quiet">
              공유
            </button>
            <span className="ml-auto self-center text-[13px] text-muted">좋아요 {formatCount(list.likeCount)}</span>
          </div>
        </header>

        <div className="flex items-center justify-between border-y border-rule px-5 py-2.5">
          <span className="text-[13px] text-muted">장소 {list.items.length}곳</span>
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
                        <PlaceActions item={item} listId={list.id} />
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
      <main className={`${view === "map" ? "block" : "hidden"} map-under-header relative min-h-0 flex-1 lg:block`}>
        <div className="absolute inset-x-0 top-0 z-10 flex items-center gap-2 bg-white/95 px-4 py-3 shadow-[0_1px_0_var(--color-rule)] lg:hidden">
          <Avatar name={list.curator.displayName} url={list.curator.avatarUrl} size={28} />
          <p className="min-w-0 truncate text-[15px] font-semibold text-ink">{list.title}</p>
        </div>
        <PlaceMap items={list.items} selectedId={selectedId} onSelect={select} showRoute={isCourse} />
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
              <PlaceActions item={selected} listId={list.id} />
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

function PlaceActions({ item, listId }: { item: ListItem; listId: string }) {
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
      <Link href="/login" className="btn-quiet">
        내 리스트에 담기
      </Link>
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
