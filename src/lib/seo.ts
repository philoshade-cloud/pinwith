import { isLang, type Lang } from "@/lib/i18n/core";

// 검색엔진용 공통 정보(정식 주소, 설명 문구, 구조화 데이터)
export const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://pinwith.me").replace(/\/$/, "");

// 리스트·큐레이터 설명이 비어 있을 때 쓰는 한 줄. 서버에는 사전이 없어서(사전은 브라우저에서 읽는다) 여기 따로 둔다.
const PLACES: Record<Lang, (n: number) => string> = {
  ko: (n) => `장소 ${n}곳`,
  en: (n) => `${n} ${n === 1 ? "place" : "places"}`,
  ja: (n) => `${n}か所のスポット`,
  "zh-CN": (n) => `${n} 个地点`,
  "zh-TW": (n) => `${n} 個地點`,
  es: (n) => `${n} ${n === 1 ? "lugar" : "lugares"}`,
  pt: (n) => `${n} ${n === 1 ? "lugar" : "lugares"}`,
  fr: (n) => `${n} ${n === 1 ? "lieu" : "lieux"}`,
  de: (n) => `${n} ${n === 1 ? "Ort" : "Orte"}`,
  it: (n) => `${n} ${n === 1 ? "luogo" : "luoghi"}`,
  ru: (n) => `Мест: ${n}`,
  ar: (n) => `${n} أماكن`,
  hi: (n) => `${n} जगहें`,
  tr: (n) => `${n} yer`,
  th: (n) => `${n} สถานที่`,
  vi: (n) => `${n} địa điểm`,
  id: (n) => `${n} tempat`,
};

const MAP_OF: Record<Lang, (name: string) => string> = {
  ko: (s) => `${s}의 장소 지도`,
  en: (s) => `${s}'s map of places`,
  ja: (s) => `${s}のスポットマップ`,
  "zh-CN": (s) => `${s} 的地点地图`,
  "zh-TW": (s) => `${s} 的地點地圖`,
  es: (s) => `Mapa de lugares de ${s}`,
  pt: (s) => `Mapa de lugares de ${s}`,
  fr: (s) => `La carte des lieux de ${s}`,
  de: (s) => `Die Ortskarte von ${s}`,
  it: (s) => `La mappa dei luoghi di ${s}`,
  ru: (s) => `Карта мест ${s}`,
  ar: (s) => `خريطة أماكن ${s}`,
  hi: (s) => `${s} का जगहों का नक्शा`,
  tr: (s) => `${s} adlı kişinin yer haritası`,
  th: (s) => `แผนที่สถานที่ของ ${s}`,
  vi: (s) => `Bản đồ địa điểm của ${s}`,
  id: (s) => `Peta tempat ${s}`,
};

export const seoLang = (v: unknown): Lang => (isLang(v) ? v : "ko");
export const placesLine = (lang: Lang, n: number) => `${PLACES[lang](n)} · PinWith`;
export const curatorLine = (lang: Lang, name: string) => MAP_OF[lang](name);

// 설명은 검색 결과에 160자 남짓 보인다
export const clip = (s: string, max = 160) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);

// <script type="application/ld+json">에 넣을 문자열('<'를 바꿔 스크립트가 중간에 닫히지 않게)
export const ldJson = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c");
