"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ago } from "@/lib/social";
import { Panel, PanelLoading } from "./shell/Panel";
import { useShell } from "./shell/context";

type N = {
  id: string;
  kind: "follow" | "like" | "comment" | "invite" | "invite_accepted" | "notice";
  body: string | null;
  read_at: string | null;
  created_at: string;
  list_id: string | null;
  actor: { id: string; handle: string; display_name: string } | null;
  list: { title: string; slug: string; owner: { handle: string } | null } | null;
};

const TEXT: Record<N["kind"], string> = {
  follow: "님이 나를 팔로우했어요",
  like: "님이 리스트를 좋아해요",
  comment: "님이 댓글을 남겼어요",
  invite: "님이 리스트 공동 편집에 초대했어요",
  invite_accepted: "님이 공동 편집 초대를 수락했어요",
  notice: "님의 새 공지",
};

// 알림: 팔로우, 좋아요, 댓글, 공동 편집 초대, 공지. 열면 모두 읽음으로 바뀐다.
export function Notifications() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { me, toast, refreshBadges } = useShell();
  const [rows, setRows] = useState<N[] | null>(null);
  const [followingBack, setFollowingBack] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return router.replace("/login?next=/notifications");
      const [{ data }, { data: f }] = await Promise.all([
        supabase
          .from("notifications")
          .select(
            "id, kind, body, read_at, created_at, list_id, actor:profiles!notifications_actor_id_fkey(id, handle, display_name)," +
              " list:lists(title, slug, owner:profiles!lists_owner_id_fkey(handle))",
          )
          .order("created_at", { ascending: false })
          .limit(100),
        supabase.from("follows").select("followee_id").eq("follower_id", auth.user.id),
      ]);
      setRows((data as unknown as N[]) ?? []);
      setFollowingBack(new Set((f ?? []).map((x) => x.followee_id as string)));
      await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null).eq("user_id", auth.user.id);
      refreshBadges();
    })();
  }, [supabase, router, refreshBadges]);

  async function followBack(id: string) {
    if (!me) return;
    const { error } = await supabase.from("follows").insert({ follower_id: me.id, followee_id: id });
    if (error) return toast("팔로우하지 못했습니다.");
    setFollowingBack(new Set([...followingBack, id]));
    toast("맞팔로우했어요. 이제 리스트를 함께 편집할 수 있어요.");
  }

  async function answerInvite(listId: string, accept: boolean) {
    if (!me) return;
    const q = accept
      ? supabase.from("list_editors").update({ accepted_at: new Date().toISOString() }).eq("list_id", listId).eq("user_id", me.id)
      : supabase.from("list_editors").delete().eq("list_id", listId).eq("user_id", me.id);
    const { error } = await q;
    if (error) return toast("이미 처리했거나 초대가 취소됐습니다.");
    toast(accept ? "공동 편집자가 됐습니다." : "초대를 거절했습니다.");
    if (accept) router.push(`/me/lists/${listId}`);
  }

  if (!rows) return <PanelLoading />;

  return (
    <Panel title="알림">
      <div className="px-5 pb-8 pt-2">
        {rows.length === 0 ? (
          <p className="py-8 text-[14px] text-muted">아직 알림이 없어요.</p>
        ) : (
          <ul className="divide-y divide-rule">
            {rows.map((n) => {
              const who = n.actor?.display_name || n.actor?.handle || "누군가";
              const listHref = n.list?.owner ? `/@${n.list.owner.handle}/${n.list.slug}` : null;
              return (
                <li key={n.id} className={`py-3 text-[14px] ${n.read_at ? "" : "bg-pin/5 -mx-5 px-5"}`}>
                  <p className="leading-snug text-ink">
                    <Link href={`/@${n.actor?.handle}`} className="font-semibold">{who}</Link>
                    {TEXT[n.kind]}
                    {n.list && listHref && (
                      <>
                        {" · "}
                        <Link href={listHref} className="font-semibold text-teal">{n.list.title}</Link>
                      </>
                    )}
                  </p>
                  {n.body && <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-[13px] text-ink/75">{n.body}</p>}
                  <p className="mt-1 flex items-center gap-2 text-[11px] text-muted">
                    {ago(n.created_at)}
                    {n.kind === "follow" && n.actor && !followingBack.has(n.actor.id) && (
                      <button type="button" onClick={() => followBack(n.actor!.id)} className="btn-primary !px-2.5 !py-1 !text-[12px]">맞팔로우</button>
                    )}
                    {n.kind === "invite" && n.list_id && (
                      <>
                        <button type="button" onClick={() => answerInvite(n.list_id!, true)} className="btn-primary !px-2.5 !py-1 !text-[12px]">수락</button>
                        <button type="button" onClick={() => answerInvite(n.list_id!, false)} className="btn-quiet !px-2.5 !py-1 !text-[12px]">거절</button>
                      </>
                    )}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Panel>
  );
}
