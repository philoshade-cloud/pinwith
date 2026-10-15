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

// 핀 카드 아래: 댓글(내가 볼 수 있는 수 표시) + 큐레이터에게 묻기
export function ItemExtras({
  itemId, listId, ownerId, isOwner,
}: {
  itemId: string;
  listId: string;
  ownerId: string;
  isOwner: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { me } = useShell();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    if (!me) return;
    supabase
      .from("item_comments")
      .select("id", { count: "exact", head: true })
      .eq("item_id", itemId)
      .then(({ count: n }) => setCount(n ?? 0));
  }, [supabase, me, itemId]);
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="btn-quiet !py-1.5 !text-[13px]">
          💬 {open ? "댓글 닫기" : `댓글${count ? ` (${count})` : ""}`}
        </button>
        {!isOwner && <DmButton userId={ownerId} listId={listId} itemId={itemId} label="큐레이터에게 묻기" className="btn-quiet !py-1.5 !text-[13px]" />}
      </div>
      {open && (
        <div className="mt-3">
          <Comments itemId={itemId} ownerId={ownerId} onCount={setCount} />
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

// 리스트 통째로 담기: 남의 리스트를 '나만 보기' 새 리스트로 복사한다(원본 표시, 이후 자유롭게 고침)
export function CopyListButton({ listId, title }: { listId: string; title: string }) {
  const router = useRouter();
  const { me, toast, refreshMine } = useShell();
  const [busy, setBusy] = useState(false);
  async function go() {
    if (!me) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    if (!window.confirm(`‘${title}’ 리스트를 통째로 내 리스트에 담을까요? 나만 보기로 만들어지고, 원본이 표시돼요.`)) return;
    setBusy(true);
    const { data, error } = await createClient().rpc("copy_list", { p_list: listId });
    setBusy(false);
    if (error || !data) return toast(error?.message.includes("too many") ? "리스트가 너무 많아요(최대 200개)." : "담지 못했습니다.");
    await refreshMine();
    toast("내 리스트에 담았어요(나만 보기).");
    router.push(`/me/lists/${data as string}`);
  }
  return (
    <button type="button" onClick={go} disabled={busy} className="btn-quiet disabled:opacity-50">
      {busy ? "담는 중" : "통째로 담기"}
    </button>
  );
}

// 복사해 온 리스트: 원본 리스트와 만든 사람을 보여준다
export function CopiedFrom({ listId }: { listId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [src, setSrc] = useState<{ title: string; slug: string; owner: { handle: string; display_name: string } | null } | null>(null);
  useEffect(() => {
    let alive = true;
    supabase
      .from("lists")
      .select("src:copied_from_list_id(title, slug, owner:profiles!lists_owner_id_fkey(handle, display_name))")
      .eq("id", listId)
      .maybeSingle()
      .then(({ data }) => alive && data?.src && setSrc(data.src as unknown as NonNullable<typeof src>));
    return () => {
      alive = false;
    };
  }, [supabase, listId]);
  if (!src?.owner) return null;
  return (
    <p className="mt-2 text-[13px] text-muted">
      원본: <a href={`/@${src.owner.handle}/${src.slug}`} className="font-semibold text-teal">{src.title}</a> · {src.owner.display_name || `@${src.owner.handle}`}
    </p>
  );
}
