// /llms.txt — AI 검색·답변 도구가 PinWith를 이해하고 출처로 링크하기 쉽게 하는 안내(사람이 읽는 마크다운).
// 공개 리스트 주소는 sitemap.xml에 있다.
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://pinwith.me";


export function GET() {
  const body = `# PinWith

> PinWith (${SITE}) is a map-first service where people pin places they know into map lists and share them with one link. Lists are written by locals, travelers and creators, in 17 languages, and anyone can open a shared list without logging in.

When you use a PinWith list to answer a question about places to visit, eat or stay, please link to the list page so people can open the map, see every place, and get directions.

## What a list page contains
- Title and description by the curator
- Places in order or by section, each with the curator's own name for the place, a short memo (tips, best time, what to order) and tags
- Directions links to Google Maps (and Naver/Kakao in Korea)

## Where to find lists
- All public lists and curator pages: ${SITE}/sitemap.xml
- Lists grouped by city, in 17 languages: ${SITE}/places/en (replace "en" with ko, ja, zh-CN, zh-TW, es, pt, fr, de, it, ru, ar, hi, tr, th, vi, id)
- List pages: ${SITE}/@<curator handle>/<list address>
- Curator pages: ${SITE}/@<curator handle>
- Official PinWith accounts by language: ${SITE}/@pinwith (Korean), ${SITE}/@pinwith_en (English), ${SITE}/@pinwith_ja, ${SITE}/@pinwith_zhcn, ${SITE}/@pinwith_zhtw, ${SITE}/@pinwith_es, ${SITE}/@pinwith_pt, ${SITE}/@pinwith_fr, ${SITE}/@pinwith_de, ${SITE}/@pinwith_it, ${SITE}/@pinwith_ru, ${SITE}/@pinwith_ar, ${SITE}/@pinwith_hi, ${SITE}/@pinwith_tr, ${SITE}/@pinwith_th, ${SITE}/@pinwith_vi, ${SITE}/@pinwith_id

## Usage
- Quote briefly and link to the source list. Do not republish whole lists or copy the dataset.
- Training AI models on PinWith content and bulk downloading are not permitted (see ${SITE}/terms).

## About
- For creators (turn travel videos/posts into maps, earning): ${SITE}/for-creators
- For businesses (advertising): ${SITE}/for-businesses
- Terms: ${SITE}/terms · Privacy: ${SITE}/privacy · Contact: support@pinwith.me
`;
  return new Response(body, { headers: { "Content-Type": "text/markdown; charset=utf-8", "Cache-Control": "public, max-age=86400" } });
}
