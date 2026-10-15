"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { ListItem, Section } from "@/lib/types";
import { addPlaceToList, DuplicatePlaceError, type AddedItem } from "@/lib/lists";
import { PlaceCard, PlaceSearchBox, type LoadedPlace } from "./PlaceSearch";

const PlaceMap = dynamic(() => import("./PlaceMap").then((m) => m.PlaceMap), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-surface" />,
});

// 어느 리스트에 넣을지: 화면에서 고르거나(내 지도), 정해진 리스트 하나(편집 화면)
export type AddTarget =
  | { mode: "pick"; lists: { id: string; title: string }[]; onCreateList: () => Promise<string> }
  | { mode: "fixed"; listId: string; sections: Section[] };

type Props = {
  items: ListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  showRoute: boolean;
  target: AddTarget;
  onAdded: (listId: string, item: AddedItem) => void;
  // 지도 위쪽에 다른 요소(모바일 제목 줄 등)가 있으면 검색창을 그만큼 내린다
  topOffsetClass?: string;
  // 화면 아래에 고정 버튼이 있으면 추가 시트의 아래 여백을 늘린다
  sheetBottomPadClass?: string;
};

const NEW_LIST = "__new__";

// 지도 위 검색 → 후보 핀 → 장소 카드와 함께 이름·메모를 적어 리스트에 추가
export function SearchableMap({
  items, selectedId, onSelect, showRoute, target, onAdded, topOffsetClass = "top-3", sheetBottomPadClass = "",
}: Props) {
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<LoadedPlace | null>(null);
  const [title, setTitle] = useState("");
  const [memo, setMemo] = useState("");
  const [listId, setListId] = useState<string>(
    target.mode === "fixed" ? target.listId : target.lists[0]?.id ?? NEW_LIST,
  );
  const [sectionId, setSectionId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchKey, setSearchKey] = useState(0);

  function pick(id: string) {
    setPlaceId(id);
    setLoaded(null);
    setTitle("");
    setMemo("");
    setError(null);
  }

  function onCardLoaded(p: LoadedPlace) {
    setLoaded(p);
    // 구글 이름은 기본값으로만 쓰고, 큐레이터가 확인한 이름을 저장한다.
    setTitle((prev) => prev || p.name);
  }

  function close() {
    setPlaceId(null);
    setLoaded(null);
    setError(null);
    setSearchKey((k) => k + 1); // 검색창 비우기
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!placeId || !loaded || !title.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const destination =
        target.mode === "fixed" ? target.listId : listId === NEW_LIST ? await target.onCreateList() : listId;
      const item = await addPlaceToList({
        listId: destination,
        placeId,
        lat: loaded.lat,
        lng: loaded.lng,
        title: title.trim(),
        memo: memo.trim(),
        sectionId: target.mode === "fixed" ? sectionId || null : null,
      });
      onAdded(destination, item);
      close();
    } catch (err) {
      setError(
        err instanceof DuplicatePlaceError
          ? "이미 이 리스트에 있는 장소입니다."
          : "장소를 추가하지 못했습니다. 잠시 후 다시 시도하세요.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="relative h-full w-full">
      <PlaceMap
        items={items}
        selectedId={selectedId}
        onSelect={onSelect}
        showRoute={showRoute}
        candidate={loaded ? { lat: loaded.lat, lng: loaded.lng } : null}
      />

      <div className={`absolute inset-x-3 z-10 mx-auto max-w-[480px] rounded-xl bg-white p-1.5 shadow-[0_4px_18px_rgba(24,34,47,0.18)] lg:left-4 lg:right-auto lg:mx-0 lg:w-[400px] ${topOffsetClass}`}>
        <PlaceSearchBox key={searchKey} onPick={pick} />
      </div>

      {placeId && (
        <form
          onSubmit={add}
          className={`absolute inset-x-0 bottom-0 z-20 max-h-[75%] overflow-y-auto rounded-t-2xl bg-white p-4 ${sheetBottomPadClass} shadow-[0_-8px_30px_rgba(24,34,47,0.18)] lg:inset-x-auto lg:bottom-4 lg:left-4 lg:w-[400px] lg:rounded-2xl`}
        >
          <div className="flex items-center">
            <h2 className="text-[15px] font-semibold text-ink">리스트에 추가</h2>
            <button type="button" onClick={close} className="ml-auto rounded p-1 text-muted hover:text-ink" aria-label="닫기">
              ✕
            </button>
          </div>
          <div className="mt-2">
            <PlaceCard placeId={placeId} onLoaded={onCardLoaded} />
          </div>
          <div className="mt-3 grid gap-3">
            <label className="grid gap-1 text-[13px] font-semibold text-ink">
              리스트에 보일 이름
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
                required
                className="field"
                placeholder={loaded ? "" : "장소 정보를 불러오는 중"}
              />
            </label>
            <label className="grid gap-1 text-[13px] font-semibold text-ink">
              메모
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                rows={2}
                className="field"
                placeholder="추천 메뉴, 가기 좋은 시간, 주의할 점"
              />
            </label>
            {target.mode === "pick" && (
              <label className="grid gap-1 text-[13px] font-semibold text-ink">
                넣을 리스트
                <select value={listId} onChange={(e) => setListId(e.target.value)} className="field">
                  {target.lists.map((l) => (
                    <option key={l.id} value={l.id}>{l.title}</option>
                  ))}
                  <option value={NEW_LIST}>+ 새 리스트 만들어 넣기</option>
                </select>
              </label>
            )}
            {target.mode === "fixed" && target.sections.length > 0 && (
              <label className="grid gap-1 text-[13px] font-semibold text-ink">
                섹션
                <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} className="field">
                  <option value="">섹션 없음</option>
                  {target.sections.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </label>
            )}
            {error && <p role="alert" className="text-[14px] text-pin">{error}</p>}
            <button
              type="submit"
              disabled={!loaded || !title.trim() || saving}
              className="btn-primary justify-center !py-2.5 disabled:opacity-40"
            >
              {saving ? "추가하는 중" : "리스트에 추가"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
