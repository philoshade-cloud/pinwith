// 임시: 배포 환경에서 구글 Text Search 연결 상태 확인용. 확인 후 삭제한다.
import { connection } from "next/server";

export async function GET() {
  await connection();
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) return Response.json({ key: false });
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "places.id,places.location",
      Referer: "https://pinwith-xiea.vercel.app/",
    },
    body: JSON.stringify({ textQuery: "대림창고 성수이로 78", languageCode: "ko", regionCode: "KR", pageSize: 1 }),
    cache: "no-store",
  });
  return Response.json({ key: true, status: res.status, body: (await res.text()).slice(0, 600) });
}
