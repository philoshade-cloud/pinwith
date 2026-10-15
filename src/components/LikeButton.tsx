"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const fmt = (n: number) => (n >= 10000 ? `${(n / 10000).toFixed(1).replace(/\.0$/, "")}만` : n.toLocaleString("ko-KR"));

// 리스트 좋아요. 로그인 전이면 로그인 후 이 화면으로 돌아온다.
export function LikeButton({ listId, initialCount, demo = false }: { listId: string; initialCount: number; demo?: boolean }) {
  const router = useRouter();
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [me, setMe] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (demo) return;
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id ?? null;
      setMe(uid);
      if (!uid) return;
      const { data: row } = await supabase.from("list_likes").select("list_id").eq("list_id", listId).eq("user_id", uid).maybeSingle();
      setLiked(!!row);
    });
  }, [listId, demo]);

  async function toggle() {
    if (demo) return;
    if (!me) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    if (busy) return;
    setBusy(true);
    const next = !liked;
    setLiked(next);
    setCount((c) => c + (next ? 1 : -1));
    const supabase = createClient();
    const { error } = next
      ? await supabase.from("list_likes").insert({ list_id: listId, user_id: me })
      : await supabase.from("list_likes").delete().eq("list_id", listId).eq("user_id", me);
    if (error) {
      setLiked(!next);
      setCount((c) => c + (next ? -1 : 1));
    }
    setBusy(false);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={liked}
      aria-label={liked ? "좋아요 취소" : "좋아요"}
      className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[15px] font-semibold transition-colors ${
        liked ? "bg-pin text-white" : "bg-white text-pin shadow-[inset_0_0_0_1.5px_var(--color-pin)] hover:bg-pin/5"
      }`}
    >
      <span aria-hidden className="text-[19px] leading-none">{liked ? "♥" : "♡"}</span>
      좋아요
      <span className="tabular-nums">{fmt(count)}</span>
    </button>
  );
}
