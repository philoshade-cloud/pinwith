"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { tr, useLang } from "@/lib/i18n/client";

// 구글 클라이언트 ID(공개 값). Google Identity Services로 로그인 창을 우리 사이트에서 띄운다.
// 이렇게 하면 구글 화면에 Supabase 주소 대신 우리 사이트 주소가 보인다.
export const GOOGLE_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
  "647613550393-d7lrh369jmb3laac8re391l91t2b10m2.apps.googleusercontent.com";

type GoogleId = {
  accounts: {
    id: {
      initialize: (o: Record<string, unknown>) => void;
      renderButton: (el: HTMLElement, o: Record<string, unknown>) => void;
    };
  };
};

async function sha256Hex(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function loadGsi(): Promise<GoogleId> {
  const w = window as unknown as { google?: GoogleId };
  if (w.google?.accounts?.id) return Promise.resolve(w.google);
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => (w.google?.accounts?.id ? resolve(w.google) : reject(new Error("gsi")));
    s.onerror = () => reject(new Error("gsi"));
    document.head.append(s);
  });
}

export function GoogleSignIn({ next, onError }: { next: string; onError: (msg: string) => void }) {
  const slot = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const lang = useLang();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // 재전송 공격 방지용 nonce: 구글에는 해시, Supabase에는 원문을 보낸다.
        const raw = crypto.randomUUID();
        const hashed = await sha256Hex(raw);
        const google = await loadGsi();
        if (cancelled || !slot.current) return;
        google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          nonce: hashed,
          ux_mode: "popup",
          use_fedcm_for_button: true,
          callback: async (res: { credential: string }) => {
            const { error } = await createClient().auth.signInWithIdToken({
              provider: "google",
              token: res.credential,
              nonce: raw,
            });
            if (error) onError(tr("구글 로그인에 실패했습니다. 잠시 후 다시 시도하세요."));
            else window.location.assign(next);
          },
        });
        google.accounts.id.renderButton(slot.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "pill",
          locale: lang,
          width: Math.min(slot.current.clientWidth || 360, 400),
        });
        setReady(true);
      } catch {
        if (!cancelled) onError(tr("구글 로그인 버튼을 불러오지 못했습니다."));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [next, onError, lang]);

  return <div ref={slot} className={`flex min-h-[44px] w-full justify-center ${ready ? "" : "rounded-full bg-surface"}`} />;
}
