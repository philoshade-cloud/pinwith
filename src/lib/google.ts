"use client";
// Google Maps JavaScript 로더. Places UI Kit(장소 검색·장소 카드)만 쓴다.
// 구글 지도 자체는 쓰지 않는다(기획안 4.5).

export const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

type GoogleNS = {
  maps: {
    importLibrary: (name: string) => Promise<Record<string, unknown>>;
  };
};

declare global {
  interface Window {
    google?: GoogleNS;
    __pinwithMapsReady?: () => void;
  }
}

let loading: Promise<Record<string, unknown>> | null = null;

export function loadPlacesLibrary(): Promise<Record<string, unknown>> {
  if (loading) return loading;
  if (!GOOGLE_MAPS_API_KEY) return Promise.reject(new Error("missing-key"));

  loading = new Promise<void>((resolve, reject) => {
    if (window.google?.maps?.importLibrary) return resolve();
    window.__pinwithMapsReady = () => resolve();
    const params = new URLSearchParams({
      key: GOOGLE_MAPS_API_KEY,
      v: "weekly",
      loading: "async",
      callback: "__pinwithMapsReady",
    });
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
    script.async = true;
    script.onerror = () => reject(new Error("load-failed"));
    script.onload = () => import("./usage").then((u) => u.logUsage("maps_js")).catch(() => {});
    document.head.append(script);
  })
    .then(() => window.google!.maps.importLibrary("places"))
    .catch((e) => {
      loading = null;
      throw e;
    });
  return loading;
}

// UI Kit 요소가 돌려주는 장소 객체에서 쓰는 필드만
export type UiKitPlace = {
  id?: string;
  displayName?: string | null;
  location?: { lat: () => number; lng: () => number } | null;
};
