"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ago } from "@/lib/social";
import { useShell } from "./shell/context";

type Post = { id: string; body: string; created_at: string; author_id: string };

// 리스트 공지(3.4): 리스트 위에 보이고, 소식 알림을 켠 팔로워에게 알림이 간다
export function NoticeComposer({ listId }: { listId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const { me, toast } = useShell();
  const [posts, setPosts] = useState<Post[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("posts")
      .select("id, body, created_at, author_id")
      .eq("list_id", listId)
      .order("created_at", { ascending: false })
      .limit(5);
    setPosts(data ?? []);
  }, [supabase, listId]);

  useEffect(() => {
    const t = window.setTimeout(load, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  async function post(e: React.FormEvent) {
    e.preventDefault();
    if (!me || !text.trim() || busy) return;
    setBusy(true);
    const { error } = await supabase.from("posts").insert({ list_id: listId, author_id: me.id, body: text.trim().slice(0, 4000) });
    setBusy(false);
    if (error) return toast("공지를 올리지 못했습니다.");
    setText("");
    toast("공지를 올렸습니다. 소식 알림을 켠 팔로워에게 알림이 갑니다.");
    load();
  }

  async function remove(id: string) {
    await supabase.from("posts").delete().eq("id", id);
    load();
  }

  return (
    <section className="mt-10" aria-labelledby="notice-h">
      <h2 id="notice-h" className="text-[15px] font-semibold text-ink">공지</h2>
      <p className="mt-1 text-[13px] text-muted">리스트 맨 위에 보이고, 소식 알림을 켠 팔로워에게 알림이 갑니다. 예: “○○집 폐업해서 뺐어요”</p>
      <form onSubmit={post} className="mt-3 grid gap-2">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={4000} className="field" placeholder="새 공지" aria-label="새 공지" />
        <button type="submit" disabled={busy || !text.trim()} className="btn-primary w-fit disabled:opacity-40">공지 올리기</button>
      </form>
      {posts.length > 0 && (
        <ul className="mt-3 divide-y divide-rule border-y border-rule">
          {posts.map((p) => (
            <li key={p.id} className="flex gap-2 py-2.5 text-[14px]">
              <span className="min-w-0 flex-1 whitespace-pre-wrap text-ink/85">{p.body}</span>
              <span className="shrink-0 text-[12px] text-muted">{ago(p.created_at)}</span>
              {p.author_id === me?.id && (
                <button type="button" onClick={() => remove(p.id)} className="shrink-0 text-[12px] text-muted underline">지우기</button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
