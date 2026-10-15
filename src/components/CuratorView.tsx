"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { createEmptyList } from "@/lib/lists";
import type { Curator, ListItem, ListSummary } from "@/lib/types";
import { FollowButton } from "./FollowButton";
import { SignOutButton } from "./SignOutButton";

const PlaceMap = dynamic(() => import("./PlaceMap").then((m) => m.PlaceMap), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-surface" />,
});
const SearchableMap = dynamic(() => import("./SearchableMap").then((m) => m.SearchableMap), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-surface" />,
});

const VIS = { public: "공개", unlisted: "링크 공개", private: "나만 보기" } as const;

// /@handle — 큐레이터의 지도. 모든 리스트의 장소를 한 지도에 모아 보여준다.
// 모바일: 지도(전체 화면) / 목록(프로필·리스트) 전환. 데스크톱: 왼쪽 목록 + 오른쪽 지도.
export function CuratorView({ curator, lists, isOwner }: { curator: Curator; lists: ListSummary[]; isOwner: boolean }) {
  const router = useRouter();
  const [view, setView] = useState<"map" | "list">(isOwner || lists.length > 0 ? "map" : "list");
  const [activeList, setActiveList] = useState<string | null>(null);
  const [selectedPin, setSelectedPin] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const shown = activeList ? lists.filter((l) => l.id === activeList) : lists;
  const pins: ListItem[] = useMemo(
    () =>
      shown.flatMap((l) =>
        l.pins.map((p, n) => ({
          id: p.id, placeId: p.placeId, title: p.title, memo: "", sectionId: null,
          position: n, tags: [], videoUrl: null, lat: p.lat, lng: p.lng,
        })),
      ),
    [shown],
  );
  const pinList = selectedPin ? lists.find((l) => l.pins.some((p) => p.id === selectedPin)) : null;
  const pinTitle = pinList?.pins.find((p) => p.id === selectedPin)?.title;
  const activeTitle = activeList ? lists.find((l) => l.id === activeList)?.title : null;

  async function newList() {
    setCreating(true);
    setError(null);
    try {
      const id = await createEmptyList();
      router.push(`/me/lists/${id}`);
    } catch {
      setError("리스트를 만들지 못했습니다. 새로고침 후 다시 시도하세요.");
      setCreating(false);
    }
  }

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: curator.displayName, url });
      else {
        await navigator.clipboard.writeText(url);
        flash("링크를 복사했습니다.");
      }
    } catch {
      /* 취소 */
    }
  }

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3000);
  }

  return (
    <div className="lg:flex lg:h-dvh">
      {/* 목록: 프로필 + 리스트 */}
      <aside className={`${view === "list" ? "block" : "hidden"} min-h-dvh overflow-y-auto bg-white pb-28 lg:block lg:min-h-0 lg:w-[420px] lg:flex-none lg:border-r lg:border-rule lg:pb-8`}>
        <header className="px-5 pb-5 pt-5">
          <nav className="flex items-center gap-4 text-[14px]">
            <Link href="/" className="font-display text-[16px] font-semibold text-pin">PinWith</Link>
            <Link href="/explore" className="ml-auto text-muted hover:text-ink">찾기</Link>
            {isOwner && <Link href="/me" className="text-muted hover:text-ink">프로필 편집</Link>}
            {isOwner && <SignOutButton />}
          </nav>
          <h1 className="font-display mt-6 text-[32px] font-semibold leading-tight tracking-[-0.02em] text-ink">
            {curator.displayName}
          </h1>
          <p className="mt-1 text-[14px] text-muted">
            @{curator.handle} · 팔로워 {curator.followerCount.toLocaleString("ko-KR")}
          </p>
          {curator.bio && <p className="mt-3 text-[15px] leading-relaxed text-ink/80">{curator.bio}</p>}
          <div className="mt-5 flex flex-wrap gap-2">
            {isOwner ? (
              <button type="button" onClick={newList} disabled={creating} className="btn-primary disabled:opacity-50">
                {creating ? "만드는 중" : "새 리스트 만들기"}
              </button>
            ) : (
              <FollowButton curatorId={curator.id} handle={curator.handle} />
            )}
            <button type="button" onClick={share} className="btn-quiet">공유</button>
          </div>
          {error && <p role="alert" className="mt-3 text-[14px] text-pin">{error}</p>}
        </header>

        <div className="border-t border-rule">
          {lists.length === 0 ? (
            <p className="px-5 py-6 text-[15px] text-muted">
              {isOwner
                ? "아직 리스트가 없습니다. 지도에서 장소를 검색해 담거나 ‘새 리스트 만들기’를 누르세요."
                : "아직 공개한 리스트가 없습니다."}
            </p>
          ) : (
            <ul>
              {lists.map((l) => (
                <li key={l.id} className={`border-b border-rule ${activeList === l.id ? "bg-surface" : ""}`}>
                  <div className="flex items-center gap-3 px-5 py-4">
                    {/* 리스트 이름을 누르면 리스트 화면으로 */}
                    <Link href={`/@${curator.handle}/${l.slug}`} className="min-w-0 flex-1">
                      <span className="block text-[17px] font-semibold text-ink">{l.title}</span>
                      <span className="mt-1 block text-[13px] text-muted">
                        장소 {l.itemCount}곳
                        {isOwner && ` · ${VIS[l.visibility]}`}
                        {l.themes.length > 0 && ` · ${l.themes.map((t) => `#${t}`).join(" ")}`}
                      </span>
                    </Link>
                    {isOwner && <Link href={`/me/lists/${l.id}`} className="btn-quiet shrink-0 !px-3">편집</Link>}
                    <Link href={`/@${curator.handle}/${l.slug}`} aria-hidden tabIndex={-1} className="shrink-0 text-[20px] text-muted">›</Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      {/* 지도 */}
      <main className={`${view === "map" ? "fixed inset-0" : "hidden"} map-ctrl-low lg:static lg:block lg:flex-1 lg:relative`}>
        {/* 모바일 상단 줄 */}
        <div className="absolute inset-x-0 top-0 z-20 flex items-center gap-2 bg-white/95 px-4 py-2.5 shadow-[0_1px_0_var(--color-rule)] lg:hidden">
          <Link href="/" className="font-display text-[15px] font-semibold text-pin">PinWith</Link>
          <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink">
            {activeTitle ?? curator.displayName}
          </span>
          {activeList && (
            <button type="button" onClick={() => setActiveList(null)} className="btn-quiet shrink-0 !px-3 !py-1">
              전체
            </button>
          )}
          <Link href="/explore" className="btn-quiet shrink-0 !px-3 !py-1">찾기</Link>
        </div>

        {activeList && (
          <button
            type="button"
            onClick={() => setActiveList(null)}
            className="absolute right-4 top-4 z-10 hidden rounded-full bg-white px-3 py-1.5 text-[14px] font-semibold text-teal shadow lg:block"
          >
            모든 리스트 보기
          </button>
        )}

        {isOwner ? (
          <SearchableMap
            items={pins}
            selectedId={selectedPin}
            onSelect={setSelectedPin}
            showRoute={false}
            topOffsetClass="top-[60px] lg:top-3"
            sheetBottomPadClass="pb-24 lg:pb-4"
            target={{
              mode: "pick",
              lists: lists.map((l) => ({ id: l.id, title: l.title })),
              onCreateList: () => createEmptyList(),
            }}
            onAdded={(listId, item) => {
              const name = lists.find((l) => l.id === listId)?.title ?? "새 리스트";
              flash(`${item.custom_title}을(를) ‘${name}’에 추가했습니다.`);
              router.refresh();
            }}
          />
        ) : (
          <PlaceMap items={pins} selectedId={selectedPin} onSelect={setSelectedPin} showRoute={false} />
        )}

        {pinList && (
          <div className="absolute inset-x-3 bottom-24 z-[5] rounded-xl bg-white p-4 shadow-[0_8px_30px_rgba(24,34,47,0.18)] lg:bottom-6 lg:left-auto lg:right-6 lg:w-[340px]">
            <div className="flex items-start">
              <div className="min-w-0 flex-1">
                <p className="text-[16px] font-semibold text-ink">{pinTitle}</p>
                <p className="mt-0.5 text-[13px] text-muted">{pinList.title}</p>
              </div>
              <button type="button" onClick={() => setSelectedPin(null)} className="-m-1 p-1 text-muted hover:text-ink" aria-label="닫기">✕</button>
            </div>
            <Link href={`/@${curator.handle}/${pinList.slug}`} className="btn-primary mt-3">이 리스트 열기</Link>
          </div>
        )}
      </main>

      {/* 모바일 전환 */}
      <div className="fixed inset-x-0 bottom-5 z-30 flex justify-center lg:hidden">
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
              {v === "map" ? "지도" : isOwner ? "내 리스트" : "프로필"}
            </button>
          ))}
        </div>
      </div>

      {toast && (
        <div role="status" className="fixed inset-x-0 bottom-20 z-40 mx-auto w-fit max-w-[90vw] rounded-full bg-ink px-4 py-2 text-[14px] text-white lg:bottom-6">
          {toast}
        </div>
      )}
    </div>
  );
}
