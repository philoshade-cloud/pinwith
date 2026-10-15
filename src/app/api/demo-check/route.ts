// 임시: 예시 장소의 구글 연결 확인용. 확인 후 삭제한다.
import { getSampleList } from "@/lib/sample";

export async function GET() {
  const list = await getSampleList();
  return Response.json(list.items.map((i) => `${i.title}: ${i.placeId ? "연결됨" : "없음"}`));
}
