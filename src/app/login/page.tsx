"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/env";

// 구글 로그인 버튼. 끄려면 환경 변수에 false를 넣는다.
const GOOGLE_LOGIN_ENABLED = process.env.NEXT_PUBLIC_GOOGLE_LOGIN_ENABLED !== "false";

// 로그인: 구글 또는 이메일 링크. 로그인 후 원래 보던 화면(next)으로 돌아간다.
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error" | "rate">("idle");
  const [sentTo, setSentTo] = useState("");

  const next = () => new URLSearchParams(window.location.search).get("next") ?? "/me?welcome=1";
  const redirectTo = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next())}`;

  async function withGoogle() {
    await createClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectTo() } });
  }

  async function withEmail(e: React.FormEvent) {
    e.preventDefault();
    // 버튼을 두 번 누르거나 Enter와 클릭이 겹치면 요청이 동시에 두 번 가서 두 번째가 실패한다.
    if (state === "sending") return;
    const address = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setState("error");
      return;
    }
    setState("sending");
    const { error } = await createClient().auth.signInWithOtp({
      email: address,
      options: { emailRedirectTo: redirectTo() },
    });
    if (!error) {
      setSentTo(address);
      return setState("sent");
    }
    setState(error.status === 429 ? "rate" : "error");
  }

  if (!isSupabaseConfigured()) {
    return (
      <main className="mx-auto max-w-[420px] px-6 py-20">
        <h1 className="font-display text-[28px] font-semibold">로그인</h1>
        <p className="mt-4 text-[15px] text-muted">서버 연결 설정이 아직 없습니다. 환경 변수를 확인하세요.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[420px] px-6 py-20">
      <h1 className="font-display text-[28px] font-semibold text-ink">PinWith에 로그인</h1>
      <p className="mt-2 text-[15px] text-muted">팔로우, 내 리스트 만들기, DM에 필요합니다.</p>
      {GOOGLE_LOGIN_ENABLED && (
        <button type="button" onClick={withGoogle} className="btn-quiet mt-8 w-full justify-center !py-3">
          구글로 계속하기
        </button>
      )}
      <form onSubmit={withEmail} className={GOOGLE_LOGIN_ENABLED ? "mt-6" : "mt-8"}>
        <label htmlFor="email" className="text-[14px] font-semibold text-ink">
          이메일로 로그인 링크 받기
        </label>
        <input
          id="email"
          name="email"
          type="text"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-2 w-full rounded-lg border border-rule px-3 py-2.5 text-[15px]"
          placeholder="you@example.com"
        />
        <button
          type="submit"
          disabled={state === "sending"}
          className="btn-primary mt-3 w-full justify-center !py-3 disabled:opacity-50"
        >
          {state === "sending" ? "보내는 중" : state === "sent" ? "다시 보내기" : "로그인 링크 보내기"}
        </button>
        <p role="status" className="mt-3 text-[14px]">
          {state === "sent" && (
            <span className="text-teal">
              {sentTo}로 로그인 링크를 보냈습니다. 메일함(스팸함 포함)에서 링크를 누르세요.
            </span>
          )}
          {state === "rate" && (
            <span className="text-pin">요청이 너무 잦습니다. 1분쯤 뒤에 다시 시도하세요.</span>
          )}
          {state === "error" && (
            <span className="text-pin">링크를 보내지 못했습니다. 이메일 주소를 확인하고 다시 시도하세요.</span>
          )}
        </p>
      </form>
    </main>
  );
}
