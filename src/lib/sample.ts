import "server-only";
import { cacheLife } from "next/cache";
import type { CuratedList, ListItem } from "./types";

// 예시 리스트: 성수동 하루 코스. 장소는 실제 장소이고, 메모는 공개 후기·소개 글을 바탕으로 썼다.
// 큐레이터는 가상의 인물이다.
// place_id는 서버에서 구글 Text Search로 찾는다(결과는 캐시). 좌표는 30일 안에서만 캐시한다.
// 구글 조회가 안 되면 아래의 대략적인 좌표로 보여주고, 그 장소는 '내 리스트에 담기'를 막는다.

type Seed = Omit<ListItem, "placeId" | "position"> & { query: string };

const seeds: Seed[] = [
  {
    id: "demo-1", query: "서울숲 성동구", title: "서울숲",
    memo: "성수역 쪽보다 서울숲역 3번 출구로 들어가면 바로 은행나무길이에요. 아침 9시 전엔 사람이 거의 없어요.",
    sectionId: "s1", tags: ["무료", "산책"], videoUrl: null, lat: 37.5444, lng: 127.0374,
  },
  {
    id: "demo-2", query: "블루보틀 성수 카페 아차산로 7", title: "블루보틀 성수",
    memo: "블루보틀 한국 1호점. 붉은 벽돌 건물 안 높은 층고가 좋아요. 핸드드립은 싱글 오리진으로.",
    sectionId: "s1", tags: ["핸드드립"], videoUrl: null, lat: 37.5482, lng: 127.0455,
  },
  {
    id: "demo-3", query: "소문난성수감자탕 연무장길 45", title: "소문난 성수 감자탕",
    memo: "24시간이라 언제 가도 되지만 점심엔 줄이 길어요. 혼자면 감자국 식사, 둘 이상이면 감자탕 중자에 수제비 추가.",
    sectionId: "s2", tags: ["24시간", "웨이팅"], videoUrl: null, lat: 37.5437, lng: 127.0555,
  },
  {
    id: "demo-4", query: "포인트오브뷰 성수 연무장길 18", title: "포인트 오브 뷰",
    memo: "작업 도구와 문구를 모은 편집숍. 12시에 열고, 매달 마지막 월요일은 쉬어요.",
    sectionId: "s3", tags: ["문구", "마지막 월 휴무"], videoUrl: null, lat: 37.5434, lng: 127.0518,
  },
  {
    id: "demo-5", query: "대림창고 성수이로 78", title: "대림창고",
    memo: "정미소였던 창고를 갤러리 카페로. 트러플 머쉬룸 포카치아와 딸기우유가 인기예요. 캐치테이블로 예약됩니다.",
    sectionId: "s3", tags: ["예약 가능", "주차 불가"], videoUrl: null, lat: 37.5419, lng: 127.0566,
  },
  {
    id: "demo-6", query: "성수족발 아차산로7길 7", title: "성수족발",
    memo: "달짝지근한 조림 족발. 자리가 적어 늘 줄이 있으니 포장해서 한강으로 가는 것도 방법이에요.",
    sectionId: "s4", tags: ["좌식", "포장 가능"], videoUrl: null, lat: 37.5452, lng: 127.0548,
  },
  {
    id: "demo-7", query: "뚝섬한강공원", title: "뚝섬한강공원",
    memo: "자양역(뚝섬유원지역) 2·3번 출구 바로 앞. 해 질 무렵 청담대교 쪽 노을로 하루를 마무리하세요.",
    sectionId: "s4", tags: ["야경", "돗자리"], videoUrl: null, lat: 37.5294, lng: 127.0665,
  },
];

const base: Omit<CuratedList, "items"> = {
  id: "demo-seongsu",
  slug: "seongsu-day",
  title: "성수동 하루, 걸어서 도는 일곱 군데",
  description:
    "아침 숲 산책부터 한강 노을까지, 지하철 없이 걸어서 이어지는 순서예요. 섹션을 누르면 시간대별 장소만 지도에 보입니다.",
  visibility: "public",
  kind: "course",
  themes: ["서울", "성수", "하루코스", "걷기좋은"],
  likeCount: 3120,
  updatedAt: "2026-10-14T09:00:00Z",
  curator: {
    id: "demo-curator",
    handle: "minji.walks",
    displayName: "민지의 걷는 서울",
    avatarUrl: null,
    bio: "서울을 걸어서 다니며 동네별 하루 코스를 만듭니다.",
    followerCount: 21400,
  },
  sections: [
    { id: "s1", name: "아침", position: 0 },
    { id: "s2", name: "점심", position: 1 },
    { id: "s3", name: "오후", position: 2 },
    { id: "s4", name: "저녁", position: 3 },
  ],
};

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://pinwith-xiea.vercel.app";

function meters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(r(b.lat - a.lat) / 2) ** 2 +
    Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

async function resolve(seed: Seed): Promise<{ placeId: string; lat: number; lng: number } | null> {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "places.id,places.location",
        Referer: `${SITE}/`,
      },
      body: JSON.stringify({
        textQuery: seed.query,
        languageCode: "ko",
        regionCode: "KR",
        pageSize: 1,
        locationBias: { circle: { center: { latitude: 37.5445, longitude: 127.0510 }, radius: 3000 } },
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { places?: { id: string; location: { latitude: number; longitude: number } }[] };
    const p = data.places?.[0];
    if (!p) return null;
    const found = { lat: p.location.latitude, lng: p.location.longitude };
    // 엉뚱한 곳이 잡히면 쓰지 않는다
    if (meters(found, { lat: seed.lat!, lng: seed.lng! }) > 1500) return null;
    return { placeId: p.id, ...found };
  } catch {
    return null;
  }
}

export async function getSampleList(): Promise<CuratedList> {
  "use cache";
  const resolved = await Promise.all(seeds.map(resolve));
  // 모두 찾았으면 1주 캐시(좌표는 30일 안에 만료). 하나라도 못 찾았으면 곧 다시 시도한다.
  if (resolved.every(Boolean)) cacheLife("weeks");
  else cacheLife("minutes");
  return {
    ...base,
    items: seeds.map((s, n) => {
      const r = resolved[n];
      return {
        id: s.id, title: s.title, memo: s.memo, sectionId: s.sectionId, tags: s.tags, videoUrl: s.videoUrl,
        position: n, placeId: r?.placeId ?? "", lat: r?.lat ?? s.lat, lng: r?.lng ?? s.lng,
      };
    }),
  };
}
