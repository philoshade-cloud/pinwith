// 구글 장소 기능 스위치(운영자 콘솔 → 서비스 사용량). 꺼져 있으면 사이트는 구글 장소 API를 부르지 않는다.
// 화면에서는 처음 한 번만 읽고, 서버는 1분마다 다시 읽는다.
import type { SupabaseClient } from "@supabase/supabase-js";

export type GoogleFlag = { enabled: boolean; auto_off: boolean; reason?: string | null; changed_at?: string; cost?: number; budget?: number };

async function read(db: SupabaseClient): Promise<GoogleFlag> {
  const { data } = await db.from("app_flags").select("value").eq("key", "google_places").maybeSingle();
  const v = (data?.value ?? {}) as Partial<GoogleFlag>;
  // 읽지 못하면 켜진 것으로 본다(스위치 때문에 사이트가 멈추지 않게)
  return { enabled: v.enabled !== false, auto_off: v.auto_off !== false, reason: v.reason ?? null, changed_at: v.changed_at, cost: v.cost, budget: v.budget };
}

let browser: Promise<GoogleFlag> | null = null;
export function googleFlagInBrowser(db: SupabaseClient) {
  browser ??= read(db).catch(() => ({ enabled: true, auto_off: true }));
  return browser;
}

let server: { at: number; value: Promise<GoogleFlag> } | null = null;
export function googleFlagOnServer(db: SupabaseClient) {
  if (!server || Date.now() - server.at > 60_000) server = { at: Date.now(), value: read(db).catch(() => ({ enabled: true, auto_off: true })) };
  return server.value;
}
