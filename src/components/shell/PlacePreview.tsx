"use client";

import { useState } from "react";
import { PlaceCard, type LoadedPlace } from "../PlaceSearch";
import { ExternalLinks } from "./ExternalLinks";
import { ReserveButton } from "../Reservation";
import { useT } from "@/lib/i18n/client";

// 검색으로 고른 장소의 미리보기: 구글 장소 카드 + 다른 지도 앱 버튼 + 리스트에 저장.
// 저장을 눌러야 이름·메모를 적는 저장 화면으로 넘어간다.
export function PlacePreview({
  placeId, known, onLoaded, onClose, onSave,
}: {
  placeId: string;
  // 검색 결과에서 이미 아는 이름·좌표
  known?: LoadedPlace;
  onLoaded: (p: LoadedPlace) => void;
  onClose: () => void;
  onSave: (p: LoadedPlace) => void;
}) {
  const t = useT();
  const [loaded, setLoaded] = useState<LoadedPlace | null>(known ?? null);
  const place = loaded ?? known ?? null;
  // 이름만 알고 좌표를 아직 못 받았으면(구글 제안에서 고른 직후) 저장·길찾기는 카드가 불러온 뒤에
  const ready = place && Number.isFinite(place.lat) && Number.isFinite(place.lng) ? place : null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 max-h-[78dvh] overflow-y-auto rounded-t-2xl bg-white p-4 pb-6 shadow-[0_-8px_30px_rgba(24,34,47,0.2)] lg:bottom-auto lg:left-4 lg:right-auto lg:top-[76px] lg:max-h-[calc(100dvh-92px)] lg:w-[400px] lg:rounded-2xl">
      <div className="flex items-center">
        <h2 className="min-w-0 flex-1 truncate text-[16px] font-semibold text-ink">{place?.name || t("장소 정보")}</h2>
        <button type="button" onClick={onClose} className="ml-2 rounded p-1 text-muted hover:text-ink" aria-label={t("닫기")}>
          ✕
        </button>
      </div>
      <div className="mt-2">
        <PlaceCard
          placeId={placeId}
          onLoaded={(p) => {
            // 장소 카드는 이름을 주지 않을 때가 있어, 검색에서 받은 이름을 지키며 합친다
            const merged = { ...p, name: p.name || known?.name || "" };
            setLoaded(merged);
            onLoaded(merged);
          }}
        />
      </div>
      <div className="-mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        <ReserveButton placeId={placeId} onOpen={onClose} className="btn-primary shrink-0 whitespace-nowrap !px-3 !py-1.5 !text-[13px]" />
        {ready && <ExternalLinks item={{ title: ready.name, placeId, lat: ready.lat, lng: ready.lng }} compact />}
      </div>
      <button
        type="button"
        onClick={() => ready && onSave(ready)}
        disabled={!ready}
        className="btn-primary mt-3 w-full justify-center !py-2.5 disabled:opacity-40"
      >
        {t("리스트에 저장")}
      </button>
    </div>
  );
}
