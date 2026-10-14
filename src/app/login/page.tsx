"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/env";

// 로그인: 구글 또는 이메일 링크. 로그인 후 원래 보던 화면(next)으로 돌아간다.
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sent" | "error">("idle");

  const next = () => new URLSearchParams(window.location.search).get("next") ?? "/me";
  const redirectTo = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next())}`;

  async function withGoogle() {
    await createClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectTo() } });
  }

  async function withEmail(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo() },
    });
    setState(error ? "error" : "sent");
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
      <button type="button" onClick={withGoogle} className="btn-quiet mt-8 w-full justify-center !py-3">
        구글로 계속하기
      </button>
      <form onSubmit={withEmail} className="mt-6">
        <label htmlFor="email" className="text-[14px] font-semibold text-ink">
          이메일로 로그인 링크 받기
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-2 w-full rounded-lg border border-rule px-3 py-2.5 text-[15px]"
          placeholder="you@example.com"
        />
        <button type="submit" className="btn-primary mt-3 w-full justify-center !py-3">
          로그인 링크 보내기
        </button>
        {state === "sent" && <p className="mt-3 text-[14px] text-teal">메일함에서 로그인 링크를 누르세요.</p>}
        {state === "error" && (
          <p className="mt-3 text-[14px] text-pin">링크를 보내지 못했습니다. 이메일 주소를 확인하고 다시 시도하세요.</p>
        )}
      </form>
    </main>
  );
}
