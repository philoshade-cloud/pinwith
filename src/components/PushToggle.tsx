"use client";

import { useEffect, useState } from "react";

type State = "loading" | "unsupported" | "ios_home" | "denied" | "off" | "on" | "busy";

function urlB64ToUint8Array(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const isIos = () => /iPhone|iPad|iPod/i.test(navigator.userAgent);
const standalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

// 휴대폰·컴퓨터 알림 켜기: 새 예약 문의, 메시지, 댓글 등을 앱을 열지 않아도 받는다.
export function PushToggle({ compact = false }: { compact?: boolean }) {
  const [state, setState] = useState<State>("loading");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        return setState(isIos() && !standalone() ? "ios_home" : "unsupported");
      }
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  async function turnOn() {
    setState("busy");
    setMsg("");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return setState(perm === "denied" ? "denied" : "off");
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const { publicKey } = await fetch("/api/push/key").then((r) => r.json());
      if (!publicKey) throw new Error("key");
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(publicKey) });
      const res = await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
      if (!res.ok) throw new Error("save");
      setState("on");
      setMsg("이 기기로 알림을 받아요.");
    } catch {
      setState("off");
      setMsg("알림을 켜지 못했어요. 잠시 후 다시 시도하세요.");
    }
  }

  async function turnOff() {
    setState("busy");
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push/subscribe", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {});
      await sub.unsubscribe().catch(() => {});
    }
    setState("off");
    setMsg("이 기기의 알림을 껐어요.");
  }

  if (state === "loading") return null;
  const box = compact ? "rounded-lg bg-surface px-3 py-2 text-[13px]" : "rounded-xl border border-rule p-3 text-[14px]";
  return (
    <div className={box}>
      {state === "ios_home" ? (
        <p className="text-ink/80">
          아이폰에서 알림을 받으려면 Safari의 <b>공유 → 홈 화면에 추가</b>로 PinWith를 홈 화면에 둔 뒤, 그 아이콘으로 열어서 여기서 알림을 켜 주세요.
        </p>
      ) : state === "unsupported" ? (
        <p className="text-muted">이 브라우저는 알림을 지원하지 않아요.</p>
      ) : state === "denied" ? (
        <p className="text-ink/80">알림이 막혀 있어요. 브라우저(또는 휴대폰) 설정에서 이 사이트의 알림을 허용해 주세요.</p>
      ) : (
        <div className="flex items-center gap-3">
          <span className="flex-1 text-ink/80">
            <b className="text-ink">이 기기로 알림 받기</b>
            <span className="block text-[12px] text-muted">새 예약 문의, 메시지, 댓글, 정산 소식을 바로 알려 드려요.</span>
          </span>
          {state === "on" ? (
            <button type="button" onClick={turnOff} className="btn-quiet shrink-0 !px-3 !py-1.5 !text-[13px]">끄기</button>
          ) : (
            <button type="button" onClick={turnOn} disabled={state === "busy"} className="btn-primary shrink-0 !px-3 !py-1.5 !text-[13px] disabled:opacity-50">
              {state === "busy" ? "켜는 중" : "켜기"}
            </button>
          )}
        </div>
      )}
      {msg && <p className="mt-1 text-[12px] text-teal">{msg}</p>}
    </div>
  );
}
