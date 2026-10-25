"use client";

import { useState } from "react";
import { addPlaceToList, createEmptyList, DuplicatePlaceError, pickDefaultList, rememberLastList, type AddedItem } from "@/lib/lists";
import type { Section } from "@/lib/types";
import type { LoadedPlace } from "../PlaceSearch";
import { useT } from "@/lib/i18n/client";
import { useListSections } from "@/lib/useListSections";
import { NEW_SECTION, resolveSection, SectionPicker } from "../SectionPicker";

const NEW_LIST = "__new__";

export type AddTarget =
  | { mode: "fixed"; listId: string; sections: Section[] }
  | { mode: "pick"; lists: { id: string; title: string }[] };

// 저장 화면: 이름·메모·넣을 리스트를 정해 추가
export function AddPlaceSheet({
  placeId, place, target, onBack, onClose, onAdded,
}: {
  placeId: string;
  place: LoadedPlace;
  target: AddTarget;
  onBack: () => void;
  onClose: () => void;
  onAdded: (listId: string, item: AddedItem, createdList: boolean) => void;
}) {
  const t = useT();
  const loaded = place;
  // 구글 이름은 기본값으로만 쓰고, 큐레이터가 확인한 이름을 저장한다.
  const [title, setTitle] = useState(place.name);
  const [memo, setMemo] = useState("");
  const [listId, setListId] = useState(() => (target.mode === "fixed" ? target.listId : pickDefaultList(target.lists) ?? NEW_LIST));
  const [sectionId, setSectionId] = useState("");
  const [newSection, setNewSection] = useState("");
  // 리스트를 고르는 경우엔 고른 리스트의 섹션을 불러와 바로 고를 수 있게
  const pickedSections = useListSections(target.mode === "pick" ? listId : null);
  const sections = target.mode === "fixed" ? target.sections : pickedSections;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!loaded || !title.trim() || saving) return;
    if (sectionId === NEW_SECTION && !newSection.trim()) return setError(t("새 섹션 이름을 입력하세요."));
    setSaving(true);
    setError(null);
    try {
      const creating = target.mode === "pick" && listId === NEW_LIST;
      const destination = target.mode === "fixed" ? target.listId : creating ? await createEmptyList() : listId;
      const section = await resolveSection(destination, sectionId, newSection, creating ? [] : sections);
      const item = await addPlaceToList({
        listId: destination,
        placeId,
        lat: loaded.lat,
        lng: loaded.lng,
        title: title.trim(),
        memo: memo.trim(),
        sectionId: section,
      });
      rememberLastList(destination);
      onAdded(destination, item, creating);
    } catch (err) {
      setError(
        err instanceof DuplicatePlaceError ? t("이미 그 리스트에 있는 장소입니다.") : t("장소를 추가하지 못했습니다. 잠시 후 다시 시도하세요."),
      );
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={add}
      className="fixed inset-x-0 bottom-0 z-40 max-h-[78dvh] overflow-y-auto rounded-t-2xl bg-white p-4 pb-6 shadow-[0_-8px_30px_rgba(24,34,47,0.2)] lg:bottom-auto lg:left-4 lg:right-auto lg:top-[76px] lg:max-h-[calc(100dvh-92px)] lg:w-[400px] lg:rounded-2xl"
    >
      <div className="flex items-center gap-2">
        <button type="button" onClick={onBack} className="-ml-1 rounded p-1 text-[18px] leading-none text-muted hover:text-ink" aria-label={t("장소 정보로 돌아가기")}>
          ‹
        </button>
        <h2 className="text-[15px] font-semibold text-ink">{t("리스트에 저장")}</h2>
        <button type="button" onClick={onClose} className="ml-auto rounded p-1 text-muted hover:text-ink" aria-label={t("닫기")}>
          ✕
        </button>
      </div>
      <div className="mt-3 grid gap-3">
        <label className="grid gap-1 text-[13px] font-semibold text-ink">
          {t("리스트에 보일 이름")}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            required
            className="field"
          />
        </label>
        <label className="grid gap-1 text-[13px] font-semibold text-ink">
          {t("메모")}
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={2}
            className="field"
            placeholder={t("추천 메뉴, 가기 좋은 시간, 주의할 점")}
          />
        </label>
        {target.mode === "pick" && (
          <label className="grid gap-1 text-[13px] font-semibold text-ink">
            {t("넣을 리스트")}
            <select value={listId} onChange={(e) => { setListId(e.target.value); setSectionId(""); }} className="field">
              {target.lists.map((l) => (
                <option key={l.id} value={l.id}>{l.title}</option>
              ))}
              <option value={NEW_LIST}>{t("+ 새 리스트 만들어 넣기")}</option>
            </select>
          </label>
        )}
        <SectionPicker sections={sections} value={sectionId} onChange={setSectionId} newName={newSection} onNewName={setNewSection} />
        {error && <p role="alert" className="text-[14px] text-pin">{error}</p>}
        <button type="submit" disabled={!loaded || !title.trim() || saving} className="btn-primary justify-center !py-2.5 disabled:opacity-40">
          {saving ? t("저장하는 중") : t("저장")}
        </button>
      </div>
    </form>
  );
}
