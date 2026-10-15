"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// 로그아웃 후 첫 화면으로. 서버 화면도 새로 그린다.
export function SignOutButton({ className = "text-muted hover:text-ink" }: { className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function signOut() {
    if (busy) return;
    setBusy(true);
    await createClient().auth.signOut();
    router.replace("/");
    router.refresh();
  }
  return (
    <button type="button" onClick={signOut} disabled={busy} className={className}>
      {busy ? "로그아웃 중" : "로그아웃"}
    </button>
  );
}
