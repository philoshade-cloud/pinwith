"use client";
// 리스트 반응 기록(큐레이터 통계·운영자 '리스트 반응'). 실패해도 사용자 동작은 막지 않는다.
// 서버(/api/ev)가 로그인 정보와 나라를 붙여 저장한다.
import { useEffect } from "react";
import { isWithinMeters } from "@/lib/links";

export type EventName =
  | "open" | "tap" | "directions" | "google_open" | "naver_open" | "kakao_open"
  | "view" | "leave" | "video" | "share" | "like" | "follow" | "save_place" | "section" | "sort_near";

type Meta = Record<string, string | number | boolean>;

// 이 기기에서는 기록하지 않기(운영자가 자기 휴대폰을 집계에서 뺄 때). 운영자 콘솔에서 켠다.
export const NO_TRACK_KEY = "pw_no_track";
const muted = () => {
  try {
    return localStorage.getItem(NO_TRACK_KEY) === "1";
  } catch {
    return false;
  }
};

// 기기 식별값은 '모두 허용'에 동의한 경우에만 만든다
function deviceId() {
  try {
    if (localStorage.getItem("pw_consent") !== "all") return null;
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

// 방문 묶음 번호: 기본은 화면 메모리에만 두어(새로고침하면 새 번호) 기기에 아무것도 남기지 않는다.
// '모두 허용'에 동의했으면 탭을 닫을 때까지(sessionStorage) 유지한다. 사람을 따라다니는 값이 아니다.
let memSession: string | null = null;
function sessionId() {
  memSession ??= Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-6);
  try {
    if (localStorage.getItem("pw_consent") !== "all") return memSession;
    const saved = sessionStorage.getItem("pw_sess");
    if (saved) return saved;
    sessionStorage.setItem("pw_sess", memSession);
  } catch {
    /* 저장소를 못 쓰면 메모리 값 */
  }
  return memSession;
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

function send(body: object, beacon = false) {
  const data = JSON.stringify(body);
  try {
    // 페이지를 떠나는 순간에도 전송되도록
    if (beacon && navigator.sendBeacon?.("/api/ev", new Blob([data], { type: "text/plain" }))) return;
    void fetch("/api/ev", { method: "POST", body: data, keepalive: true, headers: { "content-type": "text/plain" } }).catch(() => {});
  } catch {
    // 기록 실패는 무시
  }
}

export async function track(
  event: EventName,
  ctx: { listId: string; itemId?: string; lat?: number | null; lng?: number | null; code?: string | null; meta?: Meta },
  opts: { beacon?: boolean } = {},
) {
  if (!ctx.listId || ctx.listId.startsWith("demo") || muted()) return;
  const radius = event === "directions" ? await inRadius({ lat: ctx.lat ?? null, lng: ctx.lng ?? null }) : null;
  send(
    {
      event,
      listId: ctx.listId,
      itemId: ctx.itemId,
      code: ctx.code ?? undefined,
      session: sessionId(),
      device: deviceId() ?? undefined,
      inRadius: radius,
      referrer: document.referrer || undefined,
      meta: ctx.meta,
    },
    opts.beacon,
  );
}

// 리스트 화면에 들어올 때마다 'view', 화면을 떠나거나 가릴 때 머문 시간(초)을 'leave'로 보낸다.
export function useListVisit(listId: string, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    void track("view", { listId });
    let shownAt = document.visibilityState === "visible" ? Date.now() : 0;
    const flush = () => {
      if (!shownAt) return;
      const sec = Math.round((Date.now() - shownAt) / 1000);
      shownAt = 0;
      if (sec >= 1) void track("leave", { listId, meta: { sec } }, { beacon: true });
    };
    const onVis = () => {
      if (document.visibilityState === "hidden") flush();
      else if (!shownAt) shownAt = Date.now();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [listId, enabled]);
}
