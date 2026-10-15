import { renderPreview, OG_SIZE } from "@/components/og/PreviewImage";
import { getSampleList } from "@/lib/sample";

export const alt = "PinWith";
export const size = OG_SIZE;
export const contentType = "image/png";

// 기본 미리보기: 서비스 소개 문구 + 예시 코스 핀
export default async function Image() {
  const s = await getSampleList();
  return renderPreview(
    {
      title: "아는 곳을 핀으로 꽂아, 링크 하나로",
      description: "",
      curatorName: "PinWith",
      handle: "",
      count: s.items.length,
      course: true,
      themes: ["맛집", "카페", "여행코스"],
      pins: s.items.flatMap((i) => (i.lat != null && i.lng != null ? [{ lat: i.lat, lng: i.lng }] : [])),
    },
    "list",
  );
}
