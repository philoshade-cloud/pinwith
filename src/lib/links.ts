// 외부 지도로 넘기는 링크 (기획안 4.5). 앱을 여는 링크일 뿐이라 API 과금이 없다.
import type { ListItem } from "./types";

const enc = encodeURIComponent;

// 구글 지도 링크: 장소 id와 함께 '좌표'를 넘긴다.
// 예전엔 query/destination에 리스트에 적힌 이름(큐레이터가 바꾼 이름일 수 있음)을 넣었는데,
// 구글 지도 앱은 장소 id를 무시하고 그 글자로 다시 검색하는 경우가 있어
// 목적지가 비거나 지도만 열리는 일이 생겼다(10-21). 좌표는 앱에서도 항상 그 지점을 가리키고,
// 장소 id를 알아듣는 곳(웹 등)에서는 장소 id가 먼저 쓰인다(구글 문서: query는 장소 id를 못 찾을 때만 씀).
type GItem = Pick<ListItem, "title" | "placeId" | "lat" | "lng">;
const coord = (item: GItem) =>
  item.lat != null && item.lng != null ? `${Number(item.lat).toFixed(6)},${Number(item.lng).toFixed(6)}` : null;

export function googleMapsUrl(item: GItem) {
  const id = item.placeId ? `&query_place_id=${enc(item.placeId)}` : "";
  return `https://www.google.com/maps/search/?api=1&query=${enc(coord(item) ?? item.title)}${id}`;
}

export function googleDirectionsUrl(item: GItem) {
  const id = item.placeId ? `&destination_place_id=${enc(item.placeId)}` : "";
  return `https://www.google.com/maps/dir/?api=1&destination=${enc(coord(item) ?? item.title)}${id}`;
}

// 네이버 지도 웹: 좌표로 핀을 꽂는 공개 주소가 없어 이름으로 검색한다(컴퓨터용).
export function naverMapUrl(item: Pick<ListItem, "title">) {
  return `https://map.naver.com/p/search/${enc(item.title)}`;
}

// 네이버 지도 앱: 좌표에 핀을 꽂아 연다(휴대폰용). appname은 네이버가 요구하는 호출 출처 표시.
export function naverAppUrl(item: Pick<ListItem, "title" | "lat" | "lng">, origin: string) {
  return `nmap://place?lat=${item.lat}&lng=${item.lng}&name=${enc(item.title)}&appname=${enc(origin)}`;
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
