import { LANG_IDS, type Lang } from "@/lib/i18n/core";

// 도시별 소개 페이지(/places/<언어>/<도시>)에 쓰는 도시 목록.
// 리스트의 장소 중 절반 이상이 도시 중심에서 radius km 안에 있으면 그 도시 리스트로 친다.
// 공개 리스트가 MIN_LISTS개 이상인 도시만 페이지가 생긴다(내용이 빈약한 페이지는 검색엔진이 싫어함). 새 도시는 여기에 한 줄 추가.
export const MIN_LISTS = 2;

type City = { slug: string; lat: number; lng: number; radius: number; names: string };

// names: LANG_IDS 순서(ko|en|ja|zh-CN|zh-TW|es|pt|fr|de|it|ru|ar|hi|tr|th|vi|id)
const RAW: City[] = [
  { slug: "seoul", lat: 37.5665, lng: 126.978, radius: 30, names: "서울|Seoul|ソウル|首尔|首爾|Seúl|Seul|Séoul|Seoul|Seul|Сеул|سيول|सियोल|Seul|โซล|Seoul|Seoul" },
  { slug: "busan", lat: 35.1796, lng: 129.0756, radius: 30, names: "부산|Busan|釜山|釜山|釜山|Busan|Busan|Busan|Busan|Busan|Пусан|بوسان|बुसान|Busan|ปูซาน|Busan|Busan" },
  { slug: "jeju", lat: 33.38, lng: 126.55, radius: 45, names: "제주|Jeju|済州島|济州岛|濟州島|Jeju|Jeju|Jeju|Jeju|Jeju|Чеджу|جيجو|जेजू|Jeju|เชจู|Jeju|Jeju" },
  { slug: "tokyo", lat: 35.6812, lng: 139.7671, radius: 40, names: "도쿄|Tokyo|東京|东京|東京|Tokio|Tóquio|Tokyo|Tokio|Tokyo|Токио|طوكيو|टोक्यो|Tokyo|โตเกียว|Tokyo|Tokyo" },
  { slug: "osaka", lat: 34.6937, lng: 135.5023, radius: 25, names: "오사카|Osaka|大阪|大阪|大阪|Osaka|Osaka|Osaka|Osaka|Osaka|Осака|أوساكا|ओसाका|Osaka|โอซาก้า|Osaka|Osaka" },
  { slug: "kyoto", lat: 35.0116, lng: 135.7681, radius: 15, names: "교토|Kyoto|京都|京都|京都|Kioto|Quioto|Kyoto|Kyoto|Kyoto|Киото|كيوتو|क्योटो|Kyoto|เกียวโต|Kyoto|Kyoto" },
  { slug: "taipei", lat: 25.033, lng: 121.5654, radius: 25, names: "타이베이|Taipei|台北|台北|臺北|Taipéi|Taipé|Taipei|Taipeh|Taipei|Тайбэй|تايبيه|ताइपे|Taipei|ไทเป|Đài Bắc|Taipei" },
  { slug: "bangkok", lat: 13.7563, lng: 100.5018, radius: 30, names: "방콕|Bangkok|バンコク|曼谷|曼谷|Bangkok|Bangkok|Bangkok|Bangkok|Bangkok|Бангкок|بانكوك|बैंकॉक|Bangkok|กรุงเทพฯ|Bangkok|Bangkok" },
  { slug: "paris", lat: 48.8566, lng: 2.3522, radius: 20, names: "파리|Paris|パリ|巴黎|巴黎|París|Paris|Paris|Paris|Parigi|Париж|باريس|पेरिस|Paris|ปารีส|Paris|Paris" },
  { slug: "london", lat: 51.5074, lng: -0.1278, radius: 25, names: "런던|London|ロンドン|伦敦|倫敦|Londres|Londres|Londres|London|Londra|Лондон|لندن|लंदन|Londra|ลอนดอน|Luân Đôn|London" },
  { slug: "rome", lat: 41.9028, lng: 12.4964, radius: 20, names: "로마|Rome|ローマ|罗马|羅馬|Roma|Roma|Rome|Rom|Roma|Рим|روما|रोम|Roma|โรม|Rome|Roma" },
  { slug: "barcelona", lat: 41.3874, lng: 2.1686, radius: 20, names: "바르셀로나|Barcelona|バルセロナ|巴塞罗那|巴塞隆納|Barcelona|Barcelona|Barcelone|Barcelona|Barcellona|Барселона|برشلونة|बार्सिलोना|Barselona|บาร์เซโลนา|Barcelona|Barcelona" },
  { slug: "madrid", lat: 40.4168, lng: -3.7038, radius: 20, names: "마드리드|Madrid|マドリード|马德里|馬德里|Madrid|Madri|Madrid|Madrid|Madrid|Мадрид|مدريد|मैड्रिड|Madrid|มาดริด|Madrid|Madrid" },
  { slug: "lisbon", lat: 38.7223, lng: -9.1393, radius: 20, names: "리스본|Lisbon|リスボン|里斯本|里斯本|Lisboa|Lisboa|Lisbonne|Lissabon|Lisbona|Лиссабон|لشبونة|लिस्बन|Lizbon|ลิสบอน|Lisbon|Lisboa" },
  { slug: "istanbul", lat: 41.0082, lng: 28.9784, radius: 30, names: "이스탄불|Istanbul|イスタンブール|伊斯坦布尔|伊斯坦堡|Estambul|Istambul|Istanbul|Istanbul|Istanbul|Стамбул|إسطنبول|इस्तांबुल|İstanbul|อิสตันบูล|Istanbul|Istanbul" },
  { slug: "new-york", lat: 40.7128, lng: -74.006, radius: 25, names: "뉴욕|New York|ニューヨーク|纽约|紐約|Nueva York|Nova York|New York|New York|New York|Нью-Йорк|نيويورك|न्यूयॉर्क|New York|นิวยอร์ก|New York|New York" },
  { slug: "mexico-city", lat: 19.4326, lng: -99.1332, radius: 25, names: "멕시코시티|Mexico City|メキシコシティ|墨西哥城|墨西哥城|Ciudad de México|Cidade do México|Mexico|Mexiko-Stadt|Città del Messico|Мехико|مكسيكو سيتي|मेक्सिको सिटी|Meksiko|เม็กซิโกซิตี|Thành phố México|Kota Meksiko" },
];

export const CITIES = RAW;
export const findCity = (slug: string) => RAW.find((c) => c.slug === slug) ?? null;

export function cityName(c: City, lang: Lang): string {
  const names = c.names.split("|");
  return names[LANG_IDS.indexOf(lang)] || names[1];
}

// 두 좌표 사이 거리(km)
export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const dLat = r(bLat - aLat);
  const dLng = r(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}
