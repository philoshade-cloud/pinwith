"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ago } from "@/lib/social";
import { useShell } from "./shell/context";

type C = {
  id: string;
  body: string;
  created_at: string;
  author_id: string;
  hidden_by_owner: boolean;
  author: { handle: string; display_name: string } | null;
};

// 장소 댓글(3.9): 내가 팔로우하는 사람의 댓글만 보인다. 작성자는 자기 댓글을, 리스트 주인은 모든 댓글을 본다.
// 누가 볼 수 있는지는 DB(RLS)가 정한다. 여기서는 받은 것만 그린다.
export function Comments({ itemId, ownerId }: { itemId: string; ownerId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const { me } = useShell();
  const [rows, setRows] = useState<C[] | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const isOwner = !!me && me.id === ownerId;

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("item_comments")
      .select("id, body, created_at, author_id, hidden_by_owner, author:profiles!item_comments_author_id_fkey(handle, display_name)")
      .eq("item_id", itemId)
      .order("created_at", { ascending: true })
      .limit(100);
    setRows((data as unknown as C[]) ?? []);
  }, [supabase, itemId]);

  useEffect(() => {
    const t = window.setTimeout(load, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  async function post(e: React.FormEvent) {
    e.preventDefault();
    if (!me || !text.trim() || busy) return;
    setBusy(true);
    const { error } = await supabase.from("item_comments").insert({ item_id: itemId, author_id: me.id, body: text.trim().slice(0, 1000) });
    setBusy(false);
    if (!error) {
      setText("");
      load();
    }
  }

  async function setHidden(c: C, hidden: boolean) {
    await supabase.rpc("hide_comment", { comment: c.id, hidden });
    load();
  }

  async function remove(c: C) {
    await supabase.from("item_comments").delete().eq("id", c.id);
    load();
  }

  const others = (rows ?? []).filter((c) => c.author_id !== me?.id);
  const people = new Set(others.map((c) => c.author_id)).size;

  return (
    <div className="text-[13px]">
      <p className="font-semibold text-ink">
        {rows === null
          ? "댓글 불러오는 중"
          : isOwner
            ? `댓글 ${rows.length}`
            : people > 0
              ? `내가 팔로우하는 ${people}명이 댓글을 남겼어요`
              : "댓글"}
      </p>
      {!me && <p className="mt-1 text-muted">로그인하면 내가 팔로우하는 사람들의 댓글이 보여요.</p>}
      {me && rows?.length === 0 && (
        <p className="mt-1 text-muted">댓글은 내 팔로워에게만 보여요. 한 줄 평을 남겨 보세요.</p>
      )}
      <ul className="mt-2 grid max-h-48 gap-2 overflow-y-auto">
        {(rows ?? []).map((c) => (
          <li key={c.id} className={c.hidden_by_owner ? "opacity-50" : ""}>
            <p className="leading-snug">
              <Link href={`/@${c.author?.handle}`} className="font-semibold text-ink">{c.author?.display_name || c.author?.handle}</Link>{" "}
              <span className="text-ink/85">{c.body}</span>
            </p>
            <p className="mt-0.5 flex gap-2 text-[11px] text-muted">
              {ago(c.created_at)}
              {c.hidden_by_owner && <span>숨김</span>}
              {isOwner && c.author_id !== me?.id && (
                <button type="button" onClick={() => setHidden(c, !c.hidden_by_owner)} className="underline">
                  {c.hidden_by_owner ? "다시 보이기" : "숨기기"}
                </button>
              )}
              {c.author_id === me?.id && (
                <button type="button" onClick={() => remove(c)} className="underline">지우기</button>
              )}
            </p>
          </li>
        ))}
      </ul>
      {me ? (
        <form onSubmit={post} className="mt-2 flex gap-1.5">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={1000}
            placeholder="내 팔로워에게 남기는 한 줄 평"
            aria-label="댓글"
            className="field !py-1.5 !text-[13px]"
          />
          <button type="submit" disabled={busy || !text.trim()} className="btn-primary shrink-0 !px-3 !py-1.5 !text-[13px] disabled:opacity-40">
            남기기
          </button>
        </form>
      ) : (
        <Link href={`/login?next=${encodeURIComponent(typeof window === "undefined" ? "/" : window.location.pathname)}`} className="mt-2 inline-block font-semibold text-teal">
          로그인
        </Link>
      )}
    </div>
  );
}
