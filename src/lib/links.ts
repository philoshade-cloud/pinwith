// 외부 지도로 넘기는 링크 (기획안 4.5). 앱을 여는 링크일 뿐이라 API 과금이 없다.
import type { ListItem } from "./types";

const enc = encodeURIComponent;

export function googleMapsUrl(item: Pick<ListItem, "title" | "placeId">) {
  const id = item.placeId ? `&query_place_id=${enc(item.placeId)}` : "";
  return `https://www.google.com/maps/search/?api=1&query=${enc(item.title)}${id}`;
}

export function googleDirectionsUrl(item: Pick<ListItem, "title" | "placeId">) {
  const id = item.placeId ? `&destination_place_id=${enc(item.placeId)}` : "";
  return `https://www.google.com/maps/dir/?api=1&destination=${enc(item.title)}${id}`;
}

export function naverMapUrl(item: Pick<ListItem, "title">) {
  return `https://map.naver.com/p/search/${enc(item.title)}`;
}

export function kakaoMapUrl(item: Pick<ListItem, "title" | "lat" | "lng">) {
  if (item.lat == null || item.lng == null) {
    return `https://map.kakao.com/link/search/${enc(item.title)}`;
  }
  return `https://map.kakao.com/link/map/${enc(item.title)},${item.lat},${item.lng}`;
}

// 한국 영역(대략적인 경계 상자). 한국 장소에는 네이버·카카오 버튼을 함께 보여준다.
export function isInKorea(lat: number | null, lng: number | null) {
  if (lat == null || lng == null) return false;
  return lat >= 33 && lat <= 38.7 && lng >= 124.5 && lng <= 131.9;
}

// 현장 탭 판정 (기획안 6.2): 기기 안에서 거리만 계산하고 결과(true/false)만 보낸다.
export function isWithinMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
  meters = 500,
) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h)) <= meters;
}
