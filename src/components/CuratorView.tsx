"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { createEmptyList } from "@/lib/lists";
import type { Curator, ListItem, ListSummary } from "@/lib/types";

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
export function CuratorView({ curator, lists, isOwner }: { curator: Curator; lists: ListSummary[]; isOwner: boolean }) {
  const router = useRouter();
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
      else await navigator.clipboard.writeText(url);
    } catch {
      /* 취소 */
    }
  }

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh lg:flex-row">
      <aside className="order-2 flex-1 overflow-y-auto bg-white lg:order-1 lg:w-[420px] lg:flex-none lg:border-r lg:border-rule">
        <header className="px-5 pb-5 pt-6">
          <div className="flex items-center">
            <Link href="/" className="font-display text-[16px] font-semibold text-pin">PinWith</Link>
            {isOwner && (
              <Link href="/me" className="ml-auto text-[14px] text-muted hover:text-ink">프로필 편집</Link>
            )}
          </div>
          <h1 className="font-display mt-5 text-[32px] font-semibold leading-tight tracking-[-0.02em] text-ink">
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
              <Link href={`/login?next=/@${curator.handle}`} className="btn-primary">팔로우</Link>
            )}
            <button type="button" onClick={share} className="btn-quiet">공유</button>
          </div>
          {error && <p role="alert" className="mt-3 text-[14px] text-pin">{error}</p>}
        </header>

        <div className="border-t border-rule">
          {lists.length === 0 ? (
            <p className="px-5 py-6 text-[15px] text-muted">
              {isOwner
                ? "아직 리스트가 없습니다. ‘새 리스트 만들기’를 눌러 아는 장소를 담아보세요."
                : "아직 공개한 리스트가 없습니다."}
            </p>
          ) : (
            <ul>
              {activeList && (
                <li>
                  <button type="button" onClick={() => setActiveList(null)} className="w-full px-5 py-3 text-left text-[14px] font-semibold text-teal hover:bg-surface/60">
                    ← 모든 리스트 보기
                  </button>
                </li>
              )}
              {shown.map((l) => (
                <li key={l.id} className={`border-b border-rule ${activeList === l.id ? "bg-surface" : ""}`}>
                  <div className="flex items-start gap-3 px-5 py-4">
                    <button type="button" onClick={() => setActiveList(activeList === l.id ? null : l.id)} className="min-w-0 flex-1 text-left">
                      <span className="block text-[17px] font-semibold text-ink">{l.title}</span>
                      <span className="mt-1 block text-[13px] text-muted">
                        장소 {l.itemCount}곳
                        {isOwner && ` · ${VIS[l.visibility]}`}
                        {l.themes.length > 0 && ` · ${l.themes.map((t) => `#${t}`).join(" ")}`}
                      </span>
                    </button>
                    <span className="flex shrink-0 gap-1.5">
                      {isOwner && (
                        <Link href={`/me/lists/${l.id}`} className="btn-quiet !px-3">편집</Link>
                      )}
                      <Link href={`/@${curator.handle}/${l.slug}`} className="btn-quiet !px-3">열기</Link>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      <main className={`relative order-1 lg:order-2 lg:h-auto lg:flex-1 ${isOwner ? "h-[62dvh]" : "h-[45dvh]"}`}>
        {isOwner ? (
          <SearchableMap
            items={pins}
            selectedId={selectedPin}
            onSelect={setSelectedPin}
            showRoute={false}
            target={{
              mode: "pick",
              lists: lists.map((l) => ({ id: l.id, title: l.title })),
              onCreateList: () => createEmptyList(),
            }}
            onAdded={(listId, item) => {
              const name = lists.find((l) => l.id === listId)?.title ?? "새 리스트";
              setToast(`${item.custom_title}을(를) ‘${name}’에 추가했습니다.`);
              window.setTimeout(() => setToast(null), 3000);
              router.refresh();
            }}
          />
        ) : (
          <PlaceMap items={pins} selectedId={selectedPin} onSelect={setSelectedPin} showRoute={false} />
        )}
        {pinList && (
          <div className="absolute inset-x-3 bottom-3 z-[5] rounded-xl bg-white p-4 shadow-[0_8px_30px_rgba(24,34,47,0.18)] lg:left-6 lg:right-auto lg:w-[340px]">
            <p className="text-[16px] font-semibold text-ink">{pinTitle}</p>
            <p className="mt-0.5 text-[13px] text-muted">{pinList.title}</p>
            <Link href={`/@${curator.handle}/${pinList.slug}`} className="btn-primary mt-3">이 리스트 열기</Link>
          </div>
        )}
      </main>

      {toast && (
        <div role="status" className="fixed inset-x-0 bottom-6 z-30 mx-auto w-fit max-w-[90vw] rounded-full bg-ink px-4 py-2 text-[14px] text-white">
          {toast}
        </div>
      )}
    </div>
  );
}
