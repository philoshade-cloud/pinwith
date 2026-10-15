"use client";

import type { ListItem } from "@/lib/types";
import { googleDirectionsUrl, googleMapsUrl, isInKorea, kakaoMapUrl, naverAppUrl, naverMapUrl } from "@/lib/links";

type Item = Pick<ListItem, "title" | "placeId" | "lat" | "lng">;
type Ev = "directions" | "google_open" | "naver_open" | "kakao_open";

// 휴대폰에서는 네이버 지도 앱을 좌표로 열고, 앱이 없으면(1.5초 뒤에도 이 화면이면) 웹 검색으로 연다.
function openNaver(item: Item) {
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (!mobile || item.lat == null || item.lng == null) {
    window.open(naverMapUrl(item), "_blank", "noopener");
    return;
  }
  const fallback = window.setTimeout(() => {
    if (document.visibilityState === "visible") window.location.href = naverMapUrl(item);
  }, 1500);
  document.addEventListener("visibilitychange", () => window.clearTimeout(fallback), { once: true });
  window.location.href = naverAppUrl(item, window.location.origin);
}

// 다른 지도 앱으로 보내는 버튼들(상세 정보·길찾기는 그쪽에서 본다)
export function ExternalLinks({ item, onEvent }: { item: Item; onEvent?: (e: Ev) => void }) {
  const korea = isInKorea(item.lat, item.lng);
  return (
    <>
      <a href={googleDirectionsUrl(item)} target="_blank" rel="noopener" onClick={() => onEvent?.("directions")} className="btn-primary">
        길찾기
      </a>
      <a href={googleMapsUrl(item)} target="_blank" rel="noopener" onClick={() => onEvent?.("google_open")} className="btn-quiet">
        구글 지도
      </a>
      {korea && (
        <>
          <button
            type="button"
            onClick={() => {
              onEvent?.("naver_open");
              openNaver(item);
            }}
            className="btn-quiet"
          >
            네이버
          </button>
          <a href={kakaoMapUrl(item)} target="_blank" rel="noopener" onClick={() => onEvent?.("kakao_open")} className="btn-quiet">
            카카오
          </a>
        </>
      )}
    </>
  );
}
