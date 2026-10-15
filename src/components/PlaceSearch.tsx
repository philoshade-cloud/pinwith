"use client";

import { useEffect, useRef, useState } from "react";
import { loadPlacesLibrary, type UiKitPlace } from "@/lib/google";

// 구글 장소 검색창(Places UI Kit 자동완성). 고르면 place_id만 넘겨준다.
export function PlaceSearchBox({ onPick }: { onPick: (placeId: string) => void }) {
  const slot = useRef<HTMLDivElement>(null);
  const onPickRef = useRef(onPick);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);

  useEffect(() => {
    let cancelled = false;
    loadPlacesLibrary()
      .then((lib) => {
        if (cancelled || !slot.current) return;
        const Autocomplete = lib.BasicPlaceAutocompleteElement as new () => HTMLElement;
        const search = new Autocomplete();
        search.setAttribute("placeholder", "장소 이름이나 주소로 검색");
        search.style.width = "100%";
        search.style.colorScheme = "light";
        search.addEventListener("gmp-select", (event) => {
          const id = (event as unknown as { place: { id: string } }).place.id;
          onPickRef.current(id);
        });
        slot.current.replaceChildren(search);
        setStatus("ready");
      })
      .catch(() => !cancelled && setStatus("error"));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <div ref={slot} />
      {status === "loading" && <p className="px-1 py-2 text-[14px] text-muted">장소 검색을 준비하는 중</p>}
      {status === "error" && (
        <p className="px-1 py-2 text-[14px] text-pin">
          장소 검색을 불러오지 못했습니다. 잠시 후 새로고침하세요.
        </p>
      )}
    </div>
  );
}

export type LoadedPlace = { lat: number; lng: number; name: string };

// 구글 장소 카드(Places UI Kit 상세). 사진·평점·영업 여부를 구글이 그려주고, 좌표를 알려준다.
export function PlaceCard({ placeId, onLoaded }: { placeId: string; onLoaded: (p: LoadedPlace) => void }) {
  const slot = useRef<HTMLDivElement>(null);
  const request = useRef<(HTMLElement & { place: string | null }) | null>(null);
  const onLoadedRef = useRef(onLoaded);

  useEffect(() => {
    onLoadedRef.current = onLoaded;
  }, [onLoaded]);

  useEffect(() => {
    let cancelled = false;
    loadPlacesLibrary().then(() => {
      if (cancelled || !slot.current) return;
      const card = document.createElement("gmp-place-details-compact") as HTMLElement & { place?: UiKitPlace };
      card.setAttribute("orientation", "horizontal");
      card.style.colorScheme = "light";
      card.style.width = "100%";
      const req = document.createElement("gmp-place-details-place-request") as HTMLElement & {
        place: string | null;
      };
      const config = document.createElement("gmp-place-content-config");
      for (const tag of [
        "gmp-place-media",
        "gmp-place-rating",
        "gmp-place-type",
        "gmp-place-open-now-status",
        "gmp-place-attribution",
      ]) {
        config.append(document.createElement(tag));
      }
      card.append(req, config);
      card.addEventListener("gmp-load", () => {
        const loc = card.place?.location;
        if (!loc) return;
        onLoadedRef.current({ lat: loc.lat(), lng: loc.lng(), name: card.place?.displayName ?? "" });
      });
      slot.current.replaceChildren(card);
      request.current = req;
      req.place = placeId;
    });
    return () => {
      cancelled = true;
    };
    // 카드는 한 번만 만들고, 장소가 바뀌면 아래 효과에서 요청만 바꾼다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (request.current) request.current.place = placeId;
  }, [placeId]);

  return <div ref={slot} className="min-h-[72px]" />;
}
