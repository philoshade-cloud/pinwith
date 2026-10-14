"use client";

import { useEffect, useRef, useState } from "react";
import { loadPlacesLibrary, type UiKitPlace } from "@/lib/google";
import type { Section } from "@/lib/types";

export type PickedPlace = {
  placeId: string;
  lat: number;
  lng: number;
  title: string;
  memo: string;
  sectionId: string | null;
};

type Props = {
  sections: Section[];
  existingPlaceIds: Set<string>;
  onAdd: (place: PickedPlace) => Promise<void>;
};

// 장소 검색(UI Kit 자동완성) → 장소 카드(UI Kit 상세)로 좌표 확인 → 이름·메모 입력 후 추가.
// 자동완성은 place_id만 주므로, 좌표는 장소 카드가 로드된 뒤 읽는다.
export function PlacePicker({ sections, existingPlaceIds, onAdd }: Props) {
  const searchSlot = useRef<HTMLDivElement>(null);
  const cardSlot = useRef<HTMLDivElement>(null);
  const request = useRef<HTMLElement & { place: string | null }>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [picked, setPicked] = useState<{ placeId: string; lat: number | null; lng: number | null } | null>(null);
  const [title, setTitle] = useState("");
  const [memo, setMemo] = useState("");
  const [sectionId, setSectionId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadPlacesLibrary()
      .then((lib) => {
        if (cancelled || !searchSlot.current || !cardSlot.current) return;
        const Autocomplete = lib.BasicPlaceAutocompleteElement as new () => HTMLElement;
        const search = new Autocomplete();
        search.setAttribute("placeholder", "장소 이름이나 주소로 검색");
        search.style.width = "100%";
        searchSlot.current.replaceChildren(search);

        const card = document.createElement("gmp-place-details-compact") as HTMLElement & {
          place?: UiKitPlace;
        };
        card.setAttribute("orientation", "horizontal");
        card.style.colorScheme = "light";
        card.style.width = "100%";
        const req = document.createElement("gmp-place-details-place-request") as HTMLElement & {
          place: string | null;
        };
        const config = document.createElement("gmp-place-content-config");
        for (const tag of ["gmp-place-media", "gmp-place-rating", "gmp-place-type", "gmp-place-open-now-status", "gmp-place-attribution"]) {
          config.append(document.createElement(tag));
        }
        card.append(req, config);
        cardSlot.current.replaceChildren(card);
        request.current = req;

        search.addEventListener("gmp-select", (event) => {
          const id = (event as unknown as { place: { id: string } }).place.id;
          setError(null);
          setPicked({ placeId: id, lat: null, lng: null });
          setTitle("");
          req.place = id;
        });

        card.addEventListener("gmp-load", () => {
          const place = card.place;
          const loc = place?.location;
          if (!loc) return;
          setPicked((prev) => (prev ? { ...prev, lat: loc.lat(), lng: loc.lng() } : prev));
          // 구글 이름은 입력칸의 기본값으로만 쓰고, 큐레이터가 확인한 이름을 저장한다.
          setTitle((prev) => prev || place?.displayName || "");
        });

        setStatus("ready");
      })
      .catch(() => !cancelled && setStatus("error"));
    return () => {
      cancelled = true;
    };
  }, []);

  const duplicate = picked ? existingPlaceIds.has(picked.placeId) : false;
  const canAdd = picked && picked.lat != null && title.trim().length > 0 && !duplicate && !saving;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!canAdd || !picked) return;
    setSaving(true);
    setError(null);
    try {
      await onAdd({
        placeId: picked.placeId,
        lat: picked.lat!,
        lng: picked.lng!,
        title: title.trim(),
        memo: memo.trim(),
        sectionId: sectionId || null,
      });
      setPicked(null);
      setTitle("");
      setMemo("");
      if (request.current) request.current.place = null;
    } catch {
      setError("장소를 추가하지 못했습니다. 잠시 후 다시 시도하세요.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-rule bg-white p-4">
      <h2 className="text-[15px] font-semibold text-ink">장소 추가</h2>
      {status === "error" && (
        <p className="mt-2 text-[14px] text-pin">
          장소 검색을 불러오지 못했습니다. 구글 API 키와 허용된 웹사이트 주소를 확인하세요.
        </p>
      )}
      {status === "loading" && <p className="mt-2 text-[14px] text-muted">장소 검색을 준비하는 중</p>}
      <div ref={searchSlot} className="mt-3" />
      <div ref={cardSlot} className={picked ? "mt-3" : "hidden"} />

      {picked && (
        <form onSubmit={add} className="mt-3 grid gap-3">
          {duplicate && <p className="text-[14px] text-pin">이미 이 리스트에 있는 장소입니다.</p>}
          <label className="grid gap-1 text-[13px] font-semibold text-ink">
            리스트에 보일 이름
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              required
              className="field"
              placeholder={picked.lat == null ? "장소 정보를 불러오는 중" : "예: 미즈노 오코노미야키"}
            />
          </label>
          <label className="grid gap-1 text-[13px] font-semibold text-ink">
            메모
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={3}
              className="field"
              placeholder="추천 메뉴, 가기 좋은 시간, 주의할 점"
            />
          </label>
          {sections.length > 0 && (
            <label className="grid gap-1 text-[13px] font-semibold text-ink">
              섹션
              <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} className="field">
                <option value="">섹션 없음</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {error && <p className="text-[14px] text-pin">{error}</p>}
          <button type="submit" disabled={!canAdd} className="btn-primary justify-center !py-2.5 disabled:opacity-40">
            {saving ? "추가하는 중" : "리스트에 추가"}
          </button>
        </form>
      )}
    </div>
  );
}
