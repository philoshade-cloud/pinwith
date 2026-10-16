"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { CuratedList, ListItem } from "@/lib/types";
import { isWithinMeters } from "@/lib/links";
import { shortLink } from "@/lib/share";
import { track } from "@/lib/track";
import { AdSlot } from "./AdSlot";
import { FollowButton } from "./FollowButton";
import { LikeButton } from "./LikeButton";
import { DmButton, ItemExtras, ListNotice, NotifyToggle, useCommentCounts } from "./SocialBits";
import { Panel } from "./shell/Panel";
import { Tags } from "./shell/PinCard";
import { useMapScene, useShell, type Scene } from "./shell/context";

type Sort = "curator" | "nearest";

const formatCount = (n: number) =>
  n >= 10000 ? `${(n / 10000).toFixed(1).replace(/\.0$/, "")}만` : n.toLocaleString("ko-KR");

// 리스트 화면: 지도에는 이 리스트의 핀, 패널에는 큐레이터·설명·장소 목록.
export function ListExplorer({ list }: { list: CuratedList }) {
  const router = useRouter();
  const { me, selectedId, select, toast } = useShell();
  // 섹션 필터: "all", 섹션 id, "none"(섹션 없음). 지도 핀과 목록이 함께 바뀐다.
  const [section, setSection] = useState<string>("all");
  const [sort, setSort] = useState<Sort>("curator");
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);
  const isDemo = list.id.startsWith("demo");
  const isOwner = !!me && me.id === list.curator.id;
  const isCourse = list.kind === "course";

  const hasLoose = list.items.some((i) => !i.sectionId || !list.sections.some((s) => s.id === i.sectionId));
  const visibleItems = useMemo(() => {
    if (section === "all") return list.items;
    if (section === "none") return list.items.filter((i) => !i.sectionId || !list.sections.some((s) => s.id === i.sectionId));
    return list.items.filter((i) => i.sectionId === section);
  }, [list, section]);
  const numbering = useMemo(() => new Map(list.items.map((i, n) => [i.id, n + 1])), [list]);
  const commentCounts = useCommentCounts(isDemo ? [] : list.items.map((i) => i.id), !!list.publicComments);

  const groups = useMemo(() => {
    if (sort === "nearest" && here) {
      const dist = (i: ListItem) =>
        i.lat == null || i.lng == null
          ? Infinity
          : Math.hypot(i.lat - here.lat, (i.lng - here.lng) * Math.cos((here.lat * Math.PI) / 180));
      return [{ id: "near", name: "가까운 순", items: [...visibleItems].sort((a, b) => dist(a) - dist(b)) }];
    }
    const loose = visibleItems.filter((i) => !i.sectionId || !list.sections.some((s) => s.id === i.sectionId));
    return [
      ...(loose.length ? [{ id: "none", name: "", items: loose }] : []),
      ...list.sections.map((s) => ({ id: s.id, name: s.name, items: visibleItems.filter((i) => i.sectionId === s.id) })),
    ].filter((g) => g.items.length > 0);
  }, [list, visibleItems, sort, here]);

  // 섹션을 바꿀 때 선택된 장소가 사라지면 선택을 푼다
  useEffect(() => {
    if (selectedId && !visibleItems.some((i) => i.id === selectedId)) select(null);
  }, [visibleItems, selectedId, select]);

  const chips = useMemo(
    () =>
      list.sections.length === 0 ? null : (
        <div className="flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="섹션">
          {[{ id: "all", name: "전체" }, ...list.sections, ...(hasLoose ? [{ id: "none", name: "기타" }] : [])].map((sec) => (
            <button
              key={sec.id}
              type="button"
              aria-pressed={section === sec.id}
              onClick={() => setSection(sec.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-semibold shadow-[0_1px_6px_rgba(24,34,47,0.15)] transition-colors ${
                section === sec.id ? "bg-ink text-white" : "bg-white text-ink"
              }`}
            >
              {sec.name}
            </button>
          ))}
        </div>
      ),
    [list.sections, hasLoose, section],
  );

  const scene: Scene = useMemo(
    () => ({
      items: visibleItems,
      showRoute: isCourse,
      numbering,
      toolbar: chips,
      listIdOf: () => list.id,
      addTarget: isOwner
        ? { listId: list.id, sections: list.sections, onAdded: () => router.refresh() }
        : null,
      cardExtra: isDemo
        ? undefined
        : (i: ListItem) => <ItemExtras itemId={i.id} listId={list.id} ownerId={list.curator.id} isOwner={isOwner} publicComments={list.publicComments} />,
    }),
    [visibleItems, isCourse, numbering, chips, list.id, list.sections, isOwner, router, isDemo, list.curator.id],
  );
  useMapScene(scene);

  function chooseSort(next: Sort) {
    if (next === "curator") return setSort("curator");
    if (!("geolocation" in navigator)) return toast("이 기기에서는 위치를 확인할 수 없습니다.");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setHere({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setSort("nearest");
      },
      () => toast("위치 권한이 없어 큐레이터 순서로 보여줍니다."),
      { timeout: 5000 },
    );
  }

  // 열림 기록(큐레이터 통계용): 주인이 아닌 사람이 열었을 때, 같은 탭에서는 한 번만
  useEffect(() => {
    if (isDemo || me === undefined || isOwner) return;
    const key = `pw_open_${list.id}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* 저장이 막혀도 기록은 남긴다 */
    }
    const code = new URLSearchParams(window.location.search).get("s");
    track("open", { listId: list.id, code: code && /^[A-Za-z0-9]{4,12}$/.test(code) ? code : null });
  }, [isDemo, me, isOwner, list.id]);

  // 내 리스트면 공유용 짧은 링크를 미리 만들어 둔다(공유 창은 누른 즉시 떠야 해서)
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!isOwner) return;
    let alive = true;
    shortLink({ listId: list.id }, "").then((u) => alive && u && setShareUrl(u));
    return () => {
      alive = false;
    };
  }, [isOwner, list.id]);

  async function share() {
    const url = shareUrl ?? window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: list.title, url });
      else {
        await navigator.clipboard.writeText(url);
        toast("링크를 복사했습니다.");
      }
    } catch {
      /* 사용자가 공유를 취소함 */
    }
  }

  return (
    <Panel title={`${list.title} · ${list.items.length}곳`}>
      <header className="px-5 pb-5 pt-4">
        {list.siblings && list.siblings.length > 1 && (
          <label className="mb-4 flex items-center gap-2 rounded-xl bg-surface px-3 py-2 text-[13px] font-semibold text-muted">
            <span className="shrink-0">{isOwner ? "내 리스트" : `${list.curator.displayName}의 리스트`}</span>
            <select
              value={list.slug}
              onChange={(e) => router.push(`/@${list.curator.handle}/${e.target.value}`)}
              className="min-w-0 flex-1 truncate rounded-lg border border-rule bg-white px-2 py-1.5 text-[14px] font-semibold text-ink"
              aria-label="다른 리스트로 바꾸기"
            >
              {list.siblings.map((l) => (
                <option key={l.slug} value={l.slug}>{l.title}</option>
              ))}
            </select>
          </label>
        )}
        <div className="flex items-center gap-3">
          <Link href={isDemo ? "/demo" : `/@${list.curator.handle}`} className="flex min-w-0 flex-1 items-center gap-3">
            <Avatar name={list.curator.displayName} url={list.curator.avatarUrl} />
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[15px] font-semibold text-ink">{list.curator.displayName}</span>
              <span className="block truncate text-[13px] text-muted">
                @{list.curator.handle} · 팔로워 {formatCount(list.curator.followerCount)}
              </span>
            </span>
          </Link>
          {isOwner && <Link href="/me/stats" className="btn-quiet shrink-0">통계</Link>}
          {isOwner && <Link href={`/me/lists/${list.id}`} className="btn-quiet shrink-0">편집</Link>}
          {isOwner && <Link href={`/me/lists/${list.id}/notice`} className="btn-quiet shrink-0">공지</Link>}
        </div>
        <h1 className="font-display mt-5 text-[28px] font-semibold leading-[1.15] tracking-[-0.02em] text-ink text-balance">
          {list.title}
        </h1>
        {list.description && <p className="mt-2 text-[15px] leading-relaxed text-ink/80">{list.description}</p>}
        {list.items.some((i) => i.sponsored) && (
          <p className="mt-2 text-[12px] text-muted">
            <span className="mr-1 rounded border border-rule px-1 py-px text-[11px] font-semibold text-ink/70">제휴</span>
            표시된 장소는 큐레이터가 PinWith 가게 제휴로 보상을 받을 수 있는 곳이에요.
          </p>
        )}
        {list.themes.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="테마">
            {list.themes.map((t) => (
              <li key={t} className="rounded-full bg-surface px-2.5 py-1 text-[13px] text-teal">#{t}</li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <LikeButton listId={list.id} initialCount={list.likeCount} demo={isDemo} />
          {isDemo ? (
            <Link href="/login?next=/demo" className="btn-primary">팔로우</Link>
          ) : (
            !isOwner && <FollowButton curatorId={list.curator.id} handle={list.curator.handle} />
          )}
          <button type="button" onClick={share} className="btn-quiet">공유</button>
          {!isDemo && !isOwner && <DmButton userId={list.curator.id} listId={list.id} />}
        </div>
        {!isDemo && !isOwner && (
          <div className="mt-2">
            <NotifyToggle curatorId={list.curator.id} />
          </div>
        )}
        {!isDemo && <ListNotice listId={list.id} />}
        {isOwner && (
          <p className="mt-4 rounded-lg bg-surface px-3 py-2 text-[13px] text-ink/80">
            위쪽 검색창에서 장소를 찾으면 이 리스트에 바로 추가할 수 있어요.
            {!isCourse && (
              <>
                {" "}장소에 1, 2, 3 번호를 붙이려면{" "}
                <Link href={`/me/lists/${list.id}`} className="font-semibold text-teal underline">편집</Link>에서
                ‘방문 순서대로 번호 붙이기’를 켜세요.
              </>
            )}
          </p>
        )}
      </header>

      {isDemo && <DemoGuide />}

      <div className="mt-2 flex items-center justify-between border-y border-rule px-5 py-2.5">
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

      <div className="pb-6">
        {groups.map((g, gi) => (
          <section key={g.id} aria-label={g.name || "장소"}>
            {g.name && <h2 className="px-5 pb-1 pt-5 text-[13px] font-semibold text-teal">{g.name}</h2>}
            <ul>
              {g.items.map((item, ii) => (
                <li key={item.id}>
                  {/* 광고 자리: 장소 6곳마다 */}
                  {(() => {
                    const n = groups.slice(0, gi).reduce((c, x) => c + x.items.length, 0) + ii;
                    return n > 0 && n % 6 === 0 ? <AdSlot slot="list-inline" variant={n / 6} listId={isDemo ? undefined : list.id} /> : null;
                  })()}
                  <button
                    type="button"
                    onClick={() => select(item.id)}
                    aria-current={item.id === selectedId}
                    className={`w-full px-5 py-3.5 text-left transition-colors hover:bg-surface/60 ${item.id === selectedId ? "bg-surface" : ""}`}
                  >
                    <span className="flex items-baseline gap-2">
                      {isCourse && sort === "curator" && (
                        <span className="text-[13px] font-semibold tabular-nums text-pin">{numbering.get(item.id)}</span>
                      )}
                      <span className="text-[16px] font-semibold text-ink">{item.title}</span>
                      {item.sponsored && (
                        <span title="큐레이터가 이 가게와의 제휴로 보상을 받을 수 있어요" className="rounded border border-rule px-1 py-px text-[11px] font-semibold text-ink/70">
                          제휴
                        </span>
                      )}
                      {here && item.lat != null && isWithinMeters(here, { lat: item.lat, lng: item.lng! }) && (
                        <span className="text-[12px] text-teal">근처</span>
                      )}
                      {(commentCounts.get(item.id) ?? 0) > 0 && (
                        <span className="text-[12px] text-muted">💬 {commentCounts.get(item.id)}</span>
                      )}
                    </span>
                    {item.memo && <span className="mt-1 block text-[14px] leading-relaxed text-ink/75">{item.memo}</span>}
                    <Tags tags={item.tags} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {/* 광고 자리: 목록 끝 */}
        <AdSlot slot="list-end" variant={isDemo ? 0 : 1} listId={isDemo ? undefined : list.id} />
        {!isDemo && !isOwner && (
          <p className="px-5 pb-2 text-right">
            <Link href={`/support?type=report&list=${list.id}&from=${encodeURIComponent(`/@${list.curator.handle}/${list.slug}`)}`} className="text-[12px] text-muted underline">
              이 리스트 신고
            </Link>
          </p>
        )}
      </div>
    </Panel>
  );
}

export function Avatar({ name, url, size = 40 }: { name: string; url: string | null; size?: number }) {
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

// 예시 리스트에서 해볼 수 있는 기능 안내
function DemoGuide() {
  const tips = [
    ["섹션", "지도 위 아침·점심·오후·저녁을 누르면 그 시간대 핀만 남아요."],
    ["코스", "번호 순서대로 경로가 이어집니다. 정렬을 ‘가까운 순’으로 바꿀 수도 있어요."],
    ["길찾기", "장소나 핀을 누르면 구글 길찾기, 네이버, 카카오로 바로 열려요."],
    ["담기", "마음에 드는 곳은 ‘내 리스트에 담기’로 내 지도에 옮겨요."],
    ["공유", "링크 하나로 보내면 받는 사람은 로그인 없이 봅니다."],
  ];
  return (
    <div className="mx-5 rounded-xl bg-surface p-4">
      <p className="text-[13px] font-semibold text-ink">예시 리스트예요. 이렇게 써보세요</p>
      <ul className="mt-2 grid gap-1.5">
        {tips.map(([k, v]) => (
          <li key={k} className="flex gap-2 text-[13px] leading-snug text-ink/80">
            <span className="w-11 shrink-0 font-semibold text-teal">{k}</span>
            <span>{v}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
