"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { hitHref, useSavedSearch, useScopes, type SavedHit } from "@/lib/savedSearch";
import type { ListItem } from "@/lib/types";
import { Panel } from "./shell/Panel";
import { useMapScene, useShell, type Scene } from "./shell/context";
import { SavedHitRow, ScopeChips } from "./SavedHits";
import { useT } from "@/lib/i18n/client";

// 저장한 핀 검색 전체 결과: 위쪽 검색창의 '내 핀에서 모두 보기'. 찾은 장소는 지도에도 핀으로.
export function SavedSearchView() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const { me, focusNext } = useShell();
  const [q, setQ] = useState(params.get("q") ?? "");
  const { scopes, toggle } = useScopes();
  const hits = useSavedSearch(q, scopes, 100, !!me);

  function open(h: SavedHit) {
    if (h.kind === "place" && h.place_id) focusNext(h.place_id, h.lat != null && h.lng != null ? { lat: h.lat, lng: h.lng } : undefined);
    router.push(hitHref(h));
  }

  const places = useMemo(() => (hits ?? []).filter((h) => h.kind === "place" && h.item_id), [hits]);
  const lists = useMemo(() => (hits ?? []).filter((h) => h.kind === "list"), [hits]);
  const scene: Scene = useMemo(() => {
    const byId = new Map(places.map((h) => [h.item_id!, h]));
    const items: ListItem[] = places.map((h, n) => ({
      id: h.item_id!, placeId: h.place_id!, title: h.item_title ?? "", memo: h.memo ?? "", sectionId: null,
      position: n, tags: h.tags ?? [], videoUrl: null, lat: h.lat, lng: h.lng,
    }));
    return {
      items,
      listIdOf: (i) => byId.get(i.id)?.list_id,
      cardExtra: (i) => {
        const h = byId.get(i.id);
        return h ? <OpenHit hit={h} /> : null;
      },
    };
  }, [places]);
  useMapScene(scene);

  return (
    <Panel title={q.trim() ? t("내 핀에서 ‘{q}’", { q: q.trim() }) : t("내 핀에서 검색")}>
      <div className="px-5 pb-10 pt-4">
        <input
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            router.replace(`/search?q=${encodeURIComponent(e.target.value)}`, { scroll: false });
          }}
          placeholder={t("장소 이름·메모·태그·섹션·리스트 이름")}
          aria-label={t("내 핀에서 검색")}
          enterKeyHint="search"
          className="field"
          autoFocus={!q}
        />
        <div className="mt-3">
          <ScopeChips scopes={scopes} toggle={toggle} />
        </div>

        {me === null ? (
          <p className="mt-6 text-[14px] text-muted">
            {t("로그인하면 내가 저장한 핀과 팔로잉·좋아요한 리스트에서 찾을 수 있어요.")}{" "}
            <Link href="/login?next=/search" className="font-semibold text-teal underline">{t("로그인")}</Link>
          </p>
        ) : !q.trim() ? (
          <p className="mt-6 text-[14px] text-muted">{t("저장한 장소의 이름·메모·태그·섹션 이름과 리스트 이름에서 찾아요.")}</p>
        ) : scopes.length === 0 ? (
          <p className="mt-6 text-[14px] text-muted">{t("찾을 범위를 하나 이상 고르세요.")}</p>
        ) : hits === null ? (
          <p className="mt-6 text-[14px] text-muted">{t("찾는 중")}</p>
        ) : hits.length === 0 ? (
          <p className="mt-6 text-[14px] text-muted">{t("저장한 핀 중에는 없어요.")}</p>
        ) : (
          <>
            {lists.length > 0 && (
              <section className="mt-6">
                <h2 className="text-[13px] font-semibold text-muted">{t("리스트 {n}개", { n: lists.length })}</h2>
                <ul className="-mx-3 mt-1">
                  {lists.map((h) => (
                    <li key={h.list_id}><SavedHitRow hit={h} q={q} onPick={open} /></li>
                  ))}
                </ul>
              </section>
            )}
            {places.length > 0 && (
              <section className="mt-6">
                <h2 className="text-[13px] font-semibold text-muted">{t("장소 {n}곳", { n: places.length })}</h2>
                <ul className="-mx-3 mt-1">
                  {places.map((h) => (
                    <li key={h.item_id!}><SavedHitRow hit={h} q={q} onPick={open} /></li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </Panel>
  );
}

// 지도 핀 카드 아래: 그 장소가 든 리스트로
function OpenHit({ hit }: { hit: SavedHit }) {
  const t = useT();
  const { focusNext } = useShell();
  return (
    <Link
      href={hitHref(hit)}
      onClick={() => hit.place_id && focusNext(hit.place_id)}
      className="flex items-center text-[14px] font-semibold text-teal"
    >
      {t("‘{title}’ 리스트 열기", { title: hit.list_title })} <span className="ml-auto">›</span>
    </Link>
  );
}
