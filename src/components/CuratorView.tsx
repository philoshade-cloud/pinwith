"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createEmptyList } from "@/lib/lists";
import { shortLink } from "@/lib/share";
import type { Curator, ListItem, ListSummary } from "@/lib/types";
import { FollowButton } from "./FollowButton";
import { CoEditedLists } from "./CoEdit";
import { DmButton, NotifyToggle } from "./SocialBits";
import { Avatar } from "./ListExplorer";
import { Panel } from "./shell/Panel";
import { useMapScene, useShell, type Scene } from "./shell/context";

const VIS = { public: "공개", unlisted: "링크 공개", private: "나만 보기" } as const;

// 큐레이터의 지도: 모든 리스트의 장소를 지도에, 프로필과 리스트 목록은 패널에.
// 내 것이면 홈(/)에서는 패널을 접은 채로 시작한다.
export function CuratorView({
  curator, lists, isOwner, defaultOpen = true,
}: {
  curator: Curator;
  lists: ListSummary[];
  isOwner: boolean;
  defaultOpen?: boolean;
}) {
  const router = useRouter();
  const { toast } = useShell();
  const [creating, setCreating] = useState(false);

  const scene: Scene = useMemo(() => {
    const listOf = new Map<string, ListSummary>();
    const items: ListItem[] = lists.flatMap((l) =>
      l.pins.map((p, n) => {
        listOf.set(p.id, l);
        return {
          id: p.id, placeId: p.placeId, title: p.title, memo: "", sectionId: null,
          position: n, tags: [], videoUrl: null, lat: p.lat, lng: p.lng,
        };
      }),
    );
    return {
      items,
      listIdOf: (i) => listOf.get(i.id)?.id,
      cardExtra: (i) => {
        const l = listOf.get(i.id);
        return l ? (
          <Link href={`/@${curator.handle}/${l.slug}`} className="flex items-center text-[14px] font-semibold text-teal">
            ‘{l.title}’ 리스트 열기 <span className="ml-auto">›</span>
          </Link>
        ) : null;
      },
    };
  }, [lists, curator.handle]);
  useMapScene(scene);

  const placeCount = lists.reduce((n, l) => n + l.itemCount, 0);

  async function newList() {
    setCreating(true);
    try {
      const id = await createEmptyList();
      router.push(`/me/lists/${id}`);
    } catch {
      toast("리스트를 만들지 못했습니다. 새로고침 후 다시 시도하세요.");
      setCreating(false);
    }
  }

  const [shareUrl, setShareUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!isOwner) return;
    let alive = true;
    shortLink({ profileId: curator.id }, "").then((u) => alive && u && setShareUrl(u));
    return () => {
      alive = false;
    };
  }, [isOwner, curator.id]);

  async function share() {
    const url = shareUrl ?? `${window.location.origin}/@${curator.handle}`;
    try {
      if (navigator.share) await navigator.share({ title: curator.displayName, url });
      else {
        await navigator.clipboard.writeText(url);
        toast("링크를 복사했습니다.");
      }
    } catch {
      /* 취소 */
    }
  }

  const title = isOwner
    ? `내 지도 · 리스트 ${lists.length}개 · 장소 ${placeCount}곳`
    : `${curator.displayName} · 리스트 ${lists.length}개`;

  return (
    <Panel title={title} defaultOpen={defaultOpen}>
      <header className="px-5 pb-5 pt-4">
        <div className="flex items-center gap-3">
          <Avatar name={curator.displayName} url={curator.avatarUrl} size={48} />
          <div className="min-w-0 leading-tight">
            <h1 className="font-display truncate text-[24px] font-semibold tracking-[-0.02em] text-ink">{curator.displayName}</h1>
            <p className="mt-0.5 truncate text-[13px] text-muted">
              @{curator.handle} · 팔로워 {curator.followerCount.toLocaleString("ko-KR")}
            </p>
          </div>
        </div>
        {curator.bio && <p className="mt-3 text-[15px] leading-relaxed text-ink/80">{curator.bio}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          {isOwner ? (
            <button type="button" onClick={newList} disabled={creating} className="btn-primary disabled:opacity-50">
              {creating ? "만드는 중" : "새 리스트 만들기"}
            </button>
          ) : (
            <FollowButton curatorId={curator.id} handle={curator.handle} />
          )}
          <button type="button" onClick={share} className="btn-quiet">공유</button>
          {!isOwner && <DmButton userId={curator.id} />}
          {isOwner && <Link href="/me/stats" className="btn-quiet">통계</Link>}
          {isOwner && <Link href="/me" className="btn-quiet">프로필 편집</Link>}
        </div>
        {!isOwner && (
          <div className="mt-2">
            <NotifyToggle curatorId={curator.id} />
          </div>
        )}
        {isOwner && (
          <p className="mt-4 rounded-lg bg-surface px-3 py-2 text-[13px] text-ink/80">
            위쪽 검색창에서 장소를 찾아 리스트에 담을 수 있어요.
          </p>
        )}
      </header>
      {isOwner && <CoEditedLists />}

      <div className="border-t border-rule">
        {lists.length === 0 ? (
          <p className="px-5 py-6 text-[15px] text-muted">
            {isOwner
              ? "아직 리스트가 없습니다. 위쪽 검색창에서 장소를 찾아 담거나 ‘새 리스트 만들기’를 누르세요."
              : "아직 공개한 리스트가 없습니다."}
          </p>
        ) : (
          <ul>
            {lists.map((l) => (
              <li key={l.id} className="border-b border-rule">
                <div className="flex items-center gap-3 px-5 py-4">
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
    </Panel>
  );
}
