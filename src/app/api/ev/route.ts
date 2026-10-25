import { createClient as createServerSupabase } from "@/lib/supabase/server";

// 리스트 반응 기록 받기(lib/track.ts가 보냄). 나라는 Vercel이 붙여 주는 헤더로 채운다.
// 사용자 권한으로 저장하므로 link_events의 RLS(본인 또는 비로그인만)와 1분 60건 제한이 그대로 적용된다.
const EVENTS = new Set([
  "open", "tap", "directions", "google_open", "naver_open", "kakao_open",
  "view", "leave", "video", "share", "like", "follow", "save_place", "section", "sort_near",
]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHORT = /^[A-Za-z0-9_-]{1,64}$/;

type Body = {
  event?: string; listId?: string; itemId?: string; code?: string; session?: string; device?: string;
  inRadius?: boolean | null; referrer?: string; meta?: Record<string, unknown>;
};

// meta는 짧은 글자·숫자·참거짓만 몇 개 받는다
function cleanMeta(m: unknown): Record<string, string | number | boolean> | null {
  if (!m || typeof m !== "object") return null;
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(m as Record<string, unknown>).slice(0, 6)) {
    if (!/^[a-z_]{1,20}$/.test(k)) continue;
    if (typeof v === "number" && Number.isFinite(v)) out[k] = Math.round(v * 100) / 100;
    else if (typeof v === "boolean") out[k] = v;
    else if (typeof v === "string") out[k] = v.slice(0, 80);
  }
  return Object.keys(out).length ? out : null;
}

export async function POST(req: Request) {
  let b: Body;
  try {
    // sendBeacon은 text/plain으로 보내므로 글자로 받아 직접 읽는다
    b = JSON.parse(await req.text()) as Body;
  } catch {
    return new Response(null, { status: 400 });
  }
  if (!b.event || !EVENTS.has(b.event) || !b.listId || !UUID.test(b.listId)) return new Response(null, { status: 400 });

  const supabase = await createServerSupabase();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = (claims?.claims?.sub as string | undefined) ?? null;
  const country = (req.headers.get("x-vercel-ip-country") ?? "").toUpperCase();

  const row = {
    list_id: b.listId,
    item_id: b.itemId && UUID.test(b.itemId) ? b.itemId : null,
    code: b.code && /^[A-Za-z0-9]{4,12}$/.test(b.code) ? b.code : null,
    user_id: userId,
    device_id: b.device && SHORT.test(b.device) ? b.device : null,
    session_id: b.session && SHORT.test(b.session) ? b.session : null,
    event: b.event,
    in_radius: typeof b.inRadius === "boolean" ? b.inRadius : null,
    referrer: typeof b.referrer === "string" && b.referrer ? b.referrer.slice(0, 500) : null,
    country: /^[A-Z]{2}$/.test(country) ? country : null,
    meta: cleanMeta(b.meta),
  };
  const { error } = await supabase.from("link_events").insert(row);
  // 없는 링크 코드·장소가 붙어 왔으면 빼고 다시 기록
  if (error && (row.code || row.item_id)) await supabase.from("link_events").insert({ ...row, code: null, item_id: null });
  return new Response(null, { status: 204 });
}
