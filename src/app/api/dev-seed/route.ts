// 임시: 테스트 데이터용 실제 장소를 구글에서 찾아 임시 표(dev_seed)에 넣는다. 다 쓰면 삭제한다.
import { connection } from "next/server";
import { createClient } from "@supabase/supabase-js";

const Q: [string, string][] = [
  ["우래옥 을지로", "KR"], ["광장시장", "KR"], ["명동교자 본점", "KR"], ["하동관 명동", "KR"],
  ["진옥화할매원조닭한마리 종로", "KR"], ["런던베이글뮤지엄 안국", "KR"], ["어니언 안국", "KR"], ["어니언 성수", "KR"],
  ["대림창고 성수", "KR"], ["블루보틀 성수", "KR"], ["서울숲", "KR"], ["경복궁", "KR"], ["북촌한옥마을", "KR"],
  ["익선동 한옥거리", "KR"], ["경의선숲길 연남동", "KR"], ["망원시장", "KR"], ["앤트러사이트 한남", "KR"], ["N서울타워", "KR"],
  ["해운대해수욕장", "KR"], ["광안리해수욕장", "KR"], ["감천문화마을", "KR"], ["자갈치시장", "KR"], ["해동용궁사", "KR"],
  ["흰여울문화마을", "KR"], ["이재모피자 부산", "KR"], ["개미집 낙곱새 부산", "KR"], ["밀락더마켓 부산", "KR"], ["국제시장 부산", "KR"],
  ["Tsukiji Outer Market Tokyo", "JP"], ["Ichiran Shibuya", "JP"], ["Senso-ji Tokyo", "JP"], ["Shibuya Sky", "JP"],
  ["Fuunji ramen Shinjuku", "JP"], ["Blue Bottle Coffee Kiyosumi Shirakawa", "JP"], ["teamLab Planets Tokyo", "JP"], ["Meiji Jingu", "JP"],
  ["성산일출봉", "KR"], ["우도 제주", "KR"], ["협재해수욕장", "KR"], ["오설록 티뮤지엄", "KR"], ["동문재래시장 제주", "KR"],
  ["자매국수 제주", "KR"], ["카페 델문도 제주", "KR"], ["사려니숲길", "KR"],
];

export async function GET(req: Request) {
  await connection();
  if (new URL(req.url).searchParams.get("k") !== "99fdca46c9d12566") return new Response("no", { status: 404 });
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!;
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
  let ok = 0;
  await Promise.all(
    Q.map(async ([q, region]) => {
      const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask": "places.id,places.displayName,places.location",
          Referer: "https://pinwith-xiea.vercel.app/",
        },
        body: JSON.stringify({ textQuery: q, languageCode: "ko", regionCode: region, pageSize: 1 }),
        cache: "no-store",
      });
      const p = ((await res.json()) as { places?: { id: string; displayName?: { text: string }; location: { latitude: number; longitude: number } }[] }).places?.[0];
      if (!p) return;
      const { error } = await db.from("dev_seed").upsert({ q, place_id: p.id, name: p.displayName?.text ?? "", lat: p.location.latitude, lng: p.location.longitude });
      if (!error) ok++;
    }),
  );
  return Response.json({ ok, total: Q.length });
}
