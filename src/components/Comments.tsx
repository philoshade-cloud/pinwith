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
  parent_id: string | null;
  hidden_by_owner: boolean;
  author: { handle: string; display_name: string } | null;
};

export const VISIBILITY_NOTE = "댓글은 댓글을 단 사람의 팔로워와 리스트 주인에게만 보여요.";

// 장소 댓글(3.9)과 대댓글.
// 댓글: 작성자 본인, 리스트 주인, 작성자의 팔로워에게 보인다.
// 대댓글: 위에 더해 원래 댓글을 쓴 사람에게도 보인다. 원래 댓글을 지우면 대댓글도 지워진다.
// 누가 볼 수 있는지는 DB(RLS)가 정하고, 여기서는 받은 것만 그린다.
export function Comments({ itemId, ownerId, onCount }: { itemId: string; ownerId: string; onCount?: (n: number) => void }) {
  const supabase = useMemo(() => createClient(), []);
  const { me } = useShell();
  const [rows, setRows] = useState<C[] | null>(null);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [busy, setBusy] = useState(false);
  const isOwner = !!me && me.id === ownerId;

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("item_comments")
      .select("id, body, created_at, author_id, parent_id, hidden_by_owner, author:profiles!item_comments_author_id_fkey(handle, display_name)")
      .eq("item_id", itemId)
      .order("created_at", { ascending: true })
      .limit(200);
    const list = (data as unknown as C[]) ?? [];
    setRows(list);
    onCount?.(list.length);
  }, [supabase, itemId, onCount]);

  useEffect(() => {
    const t = window.setTimeout(load, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  async function post(body: string, parentId: string | null) {
    if (!me || !body.trim() || busy) return false;
    setBusy(true);
    const { error } = await supabase
      .from("item_comments")
      .insert({ item_id: itemId, author_id: me.id, body: body.trim().slice(0, 1000), parent_id: parentId });
    setBusy(false);
    if (error) return false;
    load();
    return true;
  }

  async function setHidden(c: C, hidden: boolean) {
    await supabase.rpc("hide_comment", { comment: c.id, hidden });
    load();
  }

  async function remove(c: C) {
    const replies = (rows ?? []).filter((r) => r.parent_id === c.id).length;
    if (replies && !window.confirm(`이 댓글을 지우면 대댓글 ${replies}개도 함께 지워집니다. 지울까요?`)) return;
    await supabase.from("item_comments").delete().eq("id", c.id);
    load();
  }

  const all = rows ?? [];
  const ids = new Set(all.map((c) => c.id));
  // 원래 댓글이 내게 안 보이는 대댓글은 따로 '답글'로 보여준다
  const tops = all.filter((c) => !c.parent_id || !ids.has(c.parent_id));
  const repliesOf = (id: string) => all.filter((c) => c.parent_id === id);

  function Line({ c, nested }: { c: C; nested?: boolean }) {
    return (
      <div className={`${c.hidden_by_owner ? "opacity-50" : ""} ${nested ? "ml-4 border-l-2 border-rule pl-2.5" : ""}`}>
        <p className="leading-snug">
          {c.parent_id && !nested && <span className="mr-1 text-muted">↳</span>}
          <Link href={`/@${c.author?.handle}`} className="font-semibold text-ink">{c.author?.display_name || c.author?.handle}</Link>{" "}
          <span className="text-ink/85">{c.body}</span>
        </p>
        <p className="mt-0.5 flex flex-wrap gap-2 text-[11px] text-muted">
          {ago(c.created_at)}
          {c.hidden_by_owner && <span>숨김</span>}
          {me && !c.parent_id && (
            <button type="button" onClick={() => { setReplyTo(replyTo === c.id ? null : c.id); setReplyText(""); }} className="underline">
              답글
            </button>
          )}
          {isOwner && c.author_id !== me?.id && (
            <button type="button" onClick={() => setHidden(c, !c.hidden_by_owner)} className="underline">
              {c.hidden_by_owner ? "다시 보이기" : "숨기기"}
            </button>
          )}
          {c.author_id === me?.id && <button type="button" onClick={() => remove(c)} className="underline">지우기</button>}
        </p>
      </div>
    );
  }

  return (
    <div className="text-[13px]">
      <p className="text-[12px] text-muted">{VISIBILITY_NOTE}</p>
      {!me && <p className="mt-1 text-muted">로그인하면 내가 팔로우하는 사람들의 댓글이 보여요.</p>}
      {me && rows?.length === 0 && <p className="mt-1 text-muted">아직 내게 보이는 댓글이 없어요.</p>}
      <ul className="mt-2 grid max-h-60 gap-2.5 overflow-y-auto">
        {tops.map((c) => (
          <li key={c.id} className="grid gap-1.5">
            <Line c={c} />
            {repliesOf(c.id).map((r) => (
              <Line key={r.id} c={r} nested />
            ))}
            {replyTo === c.id && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (await post(replyText, c.id)) {
                    setReplyTo(null);
                    setReplyText("");
                  }
                }}
                className="ml-4 flex gap-1.5"
              >
                <input
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  maxLength={1000}
                  autoFocus
                  placeholder="답글 (내 팔로워와 원래 댓글 쓴 사람에게 보여요)"
                  aria-label="답글"
                  className="field !py-1.5 !text-[13px]"
                />
                <button type="submit" disabled={busy || !replyText.trim()} className="btn-primary shrink-0 !px-3 !py-1.5 !text-[13px] disabled:opacity-40">
                  답글
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>
      {me ? (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (await post(text, null)) setText("");
          }}
          className="mt-2 flex gap-1.5"
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={1000}
            placeholder="댓글 남기기"
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
