// 데모용 예시 데이터. Supabase가 연결되기 전 화면 확인에 쓴다.
// place_id는 형식만 맞춘 가짜 값이다.
import type { CuratedList } from "./types";

export const sampleList: CuratedList = {
  id: "demo-osaka",
  slug: "osaka-ep3",
  title: "오사카 이틀, 줄 서도 아깝지 않은 곳",
  description:
    "EP3 영상에 나온 곳을 전부 모았어요. 난바 쪽에 숙소를 잡았다면 걸어서 다 갈 수 있습니다.",
  visibility: "public",
  kind: "collection",
  themes: ["먹방", "가성비", "혼자여행"],
  likeCount: 1284,
  updatedAt: "2026-10-12T09:00:00Z",
  curator: {
    id: "demo-curator",
    handle: "hana.eats",
    displayName: "하나의 먹는 여행",
    avatarUrl: null,
    bio: "일본 소도시와 골목 식당을 다닙니다.",
    followerCount: 48200,
  },
  sections: [
    { id: "s1", name: "아침", position: 0 },
    { id: "s2", name: "점심·저녁", position: 1 },
    { id: "s3", name: "카페와 디저트", position: 2 },
  ],
  items: [
    {
      id: "i1", placeId: "ChIJdemo_kuromon", title: "구로몬 시장",
      memo: "9시 전에 가야 참치 꼬치가 남아 있어요. 현금 챙기세요.",
      sectionId: "s1", position: 0, tags: ["현금만"], videoUrl: null,
      lat: 34.6655, lng: 135.5065,
    },
    {
      id: "i2", placeId: "ChIJdemo_mizuno", title: "미즈노 오코노미야키",
      memo: "야마이모야키가 진짜예요. 줄은 30분 정도, 회전이 빠릅니다.",
      sectionId: "s2", position: 1, tags: ["줄 있음"], videoUrl: null,
      lat: 34.6687, lng: 135.5023,
    },
    {
      id: "i3", placeId: "ChIJdemo_kamukura", title: "카무쿠라 라멘 도톤보리점",
      memo: "새벽까지 열어요. 배추 듬뿍 국물이라 늦은 밤에도 부담 없습니다.",
      sectionId: "s2", position: 2, tags: ["심야"], videoUrl: null,
      lat: 34.6688, lng: 135.5013,
    },
    {
      id: "i4", placeId: "ChIJdemo_daruma", title: "쿠시카츠 다루마 신세카이",
      memo: "소스 두 번 찍기 금지. 양배추는 무한 리필이에요.",
      sectionId: "s2", position: 3, tags: [], videoUrl: null,
      lat: 34.6523, lng: 135.5063,
    },
    {
      id: "i5", placeId: "ChIJdemo_rikuro", title: "리쿠로 오지상 치즈케이크",
      memo: "갓 구운 종이 울리면 그때 사세요. 따뜻할 때가 제일 맛있습니다.",
      sectionId: "s3", position: 4, tags: ["포장"], videoUrl: null,
      lat: 34.6649, lng: 135.5009,
    },
    {
      id: "i6", placeId: "ChIJdemo_brooklyn", title: "브루클린 로스팅 기타하마",
      memo: "강가 창가 자리가 명당. 오후 4시쯤 햇빛이 예뻐요.",
      sectionId: "s3", position: 5, tags: [], videoUrl: null,
      lat: 34.6919, lng: 135.5078,
    },
  ],
};
