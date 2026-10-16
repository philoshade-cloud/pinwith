"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n/client";

// 로그아웃 후 첫 화면으로. 서버 화면도 새로 그린다.
export function SignOutButton({ className = "text-muted hover:text-ink" }: { className?: string }) {
  const router = useRouter();
  const t = useT();
  const [busy, setBusy] = useState(false);
  async function signOut() {
    if (busy) return;
    setBusy(true);
    try {
      await createClient().auth.signOut();
      router.replace("/");
      router.refresh();
    } finally {
      // 화면을 떠나도 이 화면의 상태가 남아 있다가 다시 보일 수 있으므로(Next.js가 지난 화면을 보관) 원래대로 돌려 둔다
      setBusy(false);
    }
  }
  return (
    <button type="button" onClick={signOut} disabled={busy} className={className}>
      {busy ? t("로그아웃 중") : t("로그아웃")}
    </button>
  );
}
