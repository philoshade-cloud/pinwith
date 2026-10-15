"use client";

import { useState } from "react";
import { addPlaceToList, createEmptyList, DuplicatePlaceError, type AddedItem } from "@/lib/lists";
import type { Section } from "@/lib/types";
import { PlaceCard, type LoadedPlace } from "../PlaceSearch";

const NEW_LIST = "__new__";

export type AddTarget =
  | { mode: "fixed"; listId: string; sections: Section[] }
  | { mode: "pick"; lists: { id: string; title: string }[] };

// 검색으로 고른 장소: 구글 장소 카드 + 이름·메모를 적어 리스트에 추가
export function AddPlaceSheet({
  placeId, target, onLoaded, onClose, onAdded,
}: {
  placeId: string;
  target: AddTarget;
  onLoaded: (p: LoadedPlace) => void;
  onClose: () => void;
  onAdded: (listId: string, item: AddedItem, createdList: boolean) => void;
}) {
  const [loaded, setLoaded] = useState<LoadedPlace | null>(null);
  const [title, setTitle] = useState("");
  const [memo, setMemo] = useState("");
  const [listId, setListId] = useState(target.mode === "fixed" ? target.listId : target.lists[0]?.id ?? NEW_LIST);
  const [sectionId, setSectionId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function cardLoaded(p: LoadedPlace) {
    setLoaded(p);
    // 구글 이름은 기본값으로만 쓰고, 큐레이터가 확인한 이름을 저장한다.
    setTitle((prev) => prev || p.name);
    onLoaded(p);
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!loaded || !title.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const creating = target.mode === "pick" && listId === NEW_LIST;
      const destination = target.mode === "fixed" ? target.listId : creating ? await createEmptyList() : listId;
      const item = await addPlaceToList({
        listId: destination,
        placeId,
        lat: loaded.lat,
        lng: loaded.lng,
        title: title.trim(),
        memo: memo.trim(),
        sectionId: target.mode === "fixed" ? sectionId || null : null,
      });
      onAdded(destination, item, creating);
    } catch (err) {
      setError(
        err instanceof DuplicatePlaceError ? "이미 그 리스트에 있는 장소입니다." : "장소를 추가하지 못했습니다. 잠시 후 다시 시도하세요.",
      );
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={add}
      className="fixed inset-x-0 bottom-0 z-40 max-h-[78dvh] overflow-y-auto rounded-t-2xl bg-white p-4 pb-6 shadow-[0_-8px_30px_rgba(24,34,47,0.2)] lg:bottom-auto lg:left-4 lg:right-auto lg:top-[76px] lg:max-h-[calc(100dvh-92px)] lg:w-[400px] lg:rounded-2xl"
    >
      <div className="flex items-center">
        <h2 className="text-[15px] font-semibold text-ink">리스트에 추가</h2>
        <button type="button" onClick={onClose} className="ml-auto rounded p-1 text-muted hover:text-ink" aria-label="닫기">
          ✕
        </button>
      </div>
      <div className="mt-2">
        <PlaceCard placeId={placeId} onLoaded={cardLoaded} />
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
        <button type="submit" disabled={!loaded || !title.trim() || saving} className="btn-primary justify-center !py-2.5 disabled:opacity-40">
          {saving ? "추가하는 중" : "리스트에 추가"}
        </button>
      </div>
    </form>
  );
}
