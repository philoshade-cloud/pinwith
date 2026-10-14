"use client";
// 유입·탭 기록 (기획안 6.2). 실패해도 사용자 동작은 막지 않는다.
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/client";
import { isWithinMeters } from "@/lib/links";

type EventName = "open" | "tap" | "directions" | "google_open" | "naver_open" | "kakao_open";

function deviceId() {
  try {
    let id = localStorage.getItem("pw_device");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("pw_device", id);
    }
    return id;
  } catch {
    return null;
  }
}

// 이미 위치 권한이 있을 때만 현재 위치를 읽는다. 권한 요청 창은 띄우지 않는다.
async function inRadius(target: { lat: number | null; lng: number | null }) {
  if (target.lat == null || target.lng == null || !("geolocation" in navigator)) return null;
  try {
    const status = await navigator.permissions?.query({ name: "geolocation" });
    if (status?.state !== "granted") return null;
    const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000, maximumAge: 60000 }),
    );
    // 좌표 원본은 보내지 않고 '반경 안/밖' 결과만 보낸다.
    return isWithinMeters(
      { lat: pos.coords.latitude, lng: pos.coords.longitude },
      { lat: target.lat, lng: target.lng },
      500,
    );
  } catch {
    return null;
  }
}

export async function track(
  event: EventName,
  ctx: { listId: string; itemId?: string; lat?: number | null; lng?: number | null },
) {
  if (!isSupabaseConfigured() || ctx.listId.startsWith("demo")) return;
  try {
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    const radius =
      event === "directions" ? await inRadius({ lat: ctx.lat ?? null, lng: ctx.lng ?? null }) : null;
    await supabase.from("link_events").insert({
      list_id: ctx.listId,
      item_id: ctx.itemId ?? null,
      user_id: data.user?.id ?? null,
      device_id: deviceId(),
      event,
      in_radius: radius,
      referrer: document.referrer || null,
    });
  } catch {
    // 기록 실패는 무시
  }
}
