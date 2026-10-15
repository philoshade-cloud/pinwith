"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ago, startDm } from "@/lib/social";
import { Comments } from "./Comments";
import { useShell } from "./shell/context";

// 메시지 보내기: 리스트·장소를 붙여서 대화를 시작한다(3.8)
export function DmButton({
  userId, listId, itemId, label = "메시지", className = "btn-quiet",
}: {
  userId: string;
  listId?: string;
  itemId?: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const { me, toast } = useShell();
  const [busy, setBusy] = useState(false);
  if (me && me.id === userId) return null;
  async function go() {
    if (!me) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    setBusy(true);
    const r = await startDm(userId);
    setBusy(false);
    if ("error" in r) return toast(r.error);
    const q = new URLSearchParams();
    if (listId) q.set("list", listId);
    if (itemId) q.set("item", itemId);
    router.push(`/messages/${r.id}${q.size ? `?${q}` : ""}`);
  }
  return (
    <button type="button" onClick={go} disabled={busy} className={`${className} disabled:opacity-50`}>
      {label}
    </button>
  );
}

// 소식 알림(3.4): 팔로우한 큐레이터별로 켠다. 팔로우 직후에는 꺼져 있다.
export function NotifyToggle({ curatorId }: { curatorId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const { me, toast } = useShell();
  const [state, setState] = useState<boolean | null>(null);
  useEffect(() => {
    if (!me) return;
    supabase
      .from("follows")
      .select("notify")
      .eq("follower_id", me.id)
      .eq("followee_id", curatorId)
      .maybeSingle()
      .then(({ data }) => setState(data ? !!data.notify : null));
  }, [supabase, me, curatorId]);
  if (!me || state === null) return null;
  async function toggle() {
    const next = !state;
    setState(next);
    const { error } = await supabase.from("follows").update({ notify: next }).eq("follower_id", me!.id).eq("followee_id", curatorId);
    if (error) setState(!next);
    else toast(next ? "새 소식을 알림으로 받습니다." : "소식 알림을 껐습니다.");
  }
  return (
    <button type="button" onClick={toggle} aria-pressed={state} className="text-[12px] font-semibold text-muted hover:text-ink">
      {state ? "🔔 소식 알림 켜짐" : "🔕 소식 알림 받기"}
    </button>
  );
}

// 리스트 공지(3.4): 가장 최근 공지 하나를 리스트 위에 보여준다
export function ListNotice({ listId }: { listId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [post, setPost] = useState<{ body: string; created_at: string } | null>(null);
  useEffect(() => {
    supabase
      .from("posts")
      .select("body, created_at")
      .eq("list_id", listId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setPost(data));
  }, [supabase, listId]);
  if (!post) return null;
  return (
    <div className="mt-4 rounded-xl border border-pin/30 bg-pin/5 px-3 py-2.5">
      <p className="text-[12px] font-semibold text-pin">공지 · {ago(post.created_at)}</p>
      <p className="mt-1 whitespace-pre-wrap text-[14px] leading-relaxed text-ink">{post.body}</p>
    </div>
  );
}

// 핀 카드 아래: 댓글 보기 + 큐레이터에게 묻기
export function ItemExtras({
  itemId, listId, ownerId, isOwner,
}: {
  itemId: string;
  listId: string;
  ownerId: string;
  isOwner: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="btn-quiet !py-1.5 !text-[13px]">
          💬 {open ? "댓글 닫기" : "댓글"}
        </button>
        {!isOwner && <DmButton userId={ownerId} listId={listId} itemId={itemId} label="큐레이터에게 묻기" className="btn-quiet !py-1.5 !text-[13px]" />}
      </div>
      {open && (
        <div className="mt-3">
          <Comments itemId={itemId} ownerId={ownerId} />
        </div>
      )}
    </div>
  );
}

// 리스트 안 장소별 댓글 수(내가 볼 수 있는 것만)
export function useCommentCounts(itemIds: string[]) {
  const supabase = useMemo(() => createClient(), []);
  const { me } = useShell();
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const key = itemIds.join(",");
  useEffect(() => {
    if (!me || !key) return;
    supabase
      .from("item_comments")
      .select("item_id")
      .in("item_id", key.split(","))
      .limit(1000)
      .then(({ data }) => {
        const m = new Map<string, number>();
        for (const r of data ?? []) m.set(r.item_id as string, (m.get(r.item_id as string) ?? 0) + 1);
        setCounts(m);
      });
  }, [supabase, me, key]);
  return counts;
}
