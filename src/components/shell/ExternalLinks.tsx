"use client";

import { useState } from "react";
import type { ListItem } from "@/lib/types";
import { useT } from "@/lib/i18n/client";
import { googleDirectionsUrl, googleMapsUrl, isInKorea, kakaoMapUrl, naverAppUrl, naverMapUrl } from "@/lib/links";

type Item = Pick<ListItem, "title" | "placeId" | "lat" | "lng">;
type Ev = "directions" | "google_open" | "naver_open" | "kakao_open";

const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

// 다른 지도 앱으로 보내는 버튼들(상세 정보·길찾기는 그쪽에서 본다).
// 어느 버튼도 PinWith 화면을 바꾸지 않는다: 웹 지도는 새 탭, 앱은 앱으로 열린다.
export function ExternalLinks({ item, onEvent, compact = false }: { item: Item; onEvent?: (e: Ev) => void; compact?: boolean }) {
  const t = useT();
  // compact: 장소 카드처럼 한 줄에 버튼을 많이 둘 때(작게, 줄바꿈 없이)
  const sm = compact ? " shrink-0 whitespace-nowrap !px-3 !py-1.5 !text-[13px]" : "";
  const korea = isInKorea(item.lat, item.lng);
  // 휴대폰에서 네이버 앱이 열리지 않았을 때 보여줄 '웹에서 열기'
  const [naverWeb, setNaverWeb] = useState(false);

  function openNaver(e: React.MouseEvent<HTMLAnchorElement>) {
    onEvent?.("naver_open");
    if (!isMobile() || item.lat == null || item.lng == null) return; // 컴퓨터: 링크 그대로 새 탭
    e.preventDefault();
    // 앱이 있으면 앱으로 넘어가 이 화면은 그대로 남는다.
    // 1.5초 뒤에도 이 화면이 보이면 앱이 없는 것: 같은 탭을 바꾸지 않고 새 탭 링크를 띄운다.
    let left = false;
    const onHide = () => (left = true);
    document.addEventListener("visibilitychange", onHide, { once: true });
    window.location.href = naverAppUrl(item, window.location.origin);
    window.setTimeout(() => {
      document.removeEventListener("visibilitychange", onHide);
      if (!left && document.visibilityState === "visible") setNaverWeb(true);
    }, 1500);
  }

  return (
    <>
      <a href={googleDirectionsUrl(item)} target="_blank" rel="noopener" onClick={() => onEvent?.("directions")} className={`btn-primary${sm}`}>
        {t("길찾기")}
      </a>
      <a href={googleMapsUrl(item)} target="_blank" rel="noopener" onClick={() => onEvent?.("google_open")} className={`btn-quiet${sm}`}>
        {t("구글 지도")}
      </a>
      {korea && (
        <>
          <a href={naverMapUrl(item)} target="_blank" rel="noopener" onClick={openNaver} className={`btn-quiet${sm}`}>
            {t("네이버")}
          </a>
          <a href={kakaoMapUrl(item)} target="_blank" rel="noopener" onClick={() => onEvent?.("kakao_open")} className={`btn-quiet${sm}`}>
            {t("카카오")}
          </a>
        </>
      )}
      {naverWeb && (
        <span className="flex w-full shrink-0 items-center gap-2 whitespace-nowrap rounded-lg bg-surface px-3 py-2 text-[13px] text-ink/80">
          {t("네이버 지도 앱이 열리지 않았나요?")}
          <a
            href={naverMapUrl(item)}
            target="_blank"
            rel="noopener"
            onClick={() => setNaverWeb(false)}
            className="ml-auto shrink-0 font-semibold text-teal underline"
          >
            {t("웹에서 열기")}
          </a>
        </span>
      )}
    </>
  );
}
