"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ago } from "@/lib/social";
import { useMonetization, won } from "@/lib/monetization";
import { Panel, PanelLoading } from "./shell/Panel";
import { useShell } from "./shell/context";

type N = {
  id: string;
  kind: "follow" | "like" | "comment" | "reply" | "invite" | "invite_accepted" | "share_changed" | "notice" | "resolved";
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
  reply: "님이 내 댓글에 답글을 남겼어요",
  share_changed: "님이 공동 편집 수익 배분을 바꿨어요",
  resolved: "님이 내 메시지를 리스트에 반영했어요",
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
  const [muted, setMuted] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return router.replace("/login?next=/notifications");
      const [{ data }, { data: f }, { data: mutes }] = await Promise.all([
        supabase
          .from("notifications")
          .select(
            "id, kind, body, read_at, created_at, list_id, actor:profiles!notifications_actor_id_fkey(id, handle, display_name)," +
              " list:lists(title, slug, owner:profiles!lists_owner_id_fkey(handle))",
          )
          .order("created_at", { ascending: false })
          .limit(100),
        supabase.from("follows").select("followee_id").eq("follower_id", auth.user.id),
        supabase.from("list_mutes").select("list_id").eq("user_id", auth.user.id),
      ]);
      setMuted(new Set((mutes ?? []).map((m) => m.list_id as string)));
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

  // 알림 끄기: 이 리스트에서 오는 알림(공지·댓글·좋아요 등)을 더 받지 않는다
  async function mute(listId: string, on: boolean) {
    if (!me) return;
    const { error } = on
      ? await supabase.from("list_mutes").insert({ user_id: me.id, list_id: listId })
      : await supabase.from("list_mutes").delete().eq("user_id", me.id).eq("list_id", listId);
    if (error) return toast("바꾸지 못했습니다.");
    const next = new Set(muted);
    if (on) next.add(listId);
    else next.delete(listId);
    setMuted(next);
    toast(on ? "이 리스트의 알림을 껐어요." : "이 리스트의 알림을 다시 받아요.");
  }

  const money = useMonetization(!!me);

  if (!rows) return <PanelLoading />;

  return (
    <Panel title="알림">
      <div className="px-5 pb-8 pt-2">
        {money?.eligible && !money.monetizing && <MonetizeReady m={money} />}
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
                    {n.list_id && n.kind !== "invite" && n.kind !== "share_changed" && (
                      <button type="button" onClick={() => mute(n.list_id!, !muted.has(n.list_id!))} className="ml-auto underline">
                        {muted.has(n.list_id) ? "알림 다시 받기" : "이 리스트 알림 끄기"}
                      </button>
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

// 알림 맨 위 고정: 수익화 기준을 넘었는데 아직 수익화한 리스트가 없을 때만 보인다.
// 리스트 하나라도 수익화를 켜면 사라진다.
function MonetizeReady({ m }: { m: NonNullable<ReturnType<typeof useMonetization>> }) {
  const why =
    m.followers >= m.min_followers
      ? `팔로워 ${won(m.followers)}명`
      : m.views_30d >= m.min_ad_views_30d
        ? `최근 30일 광고 노출 ${won(m.views_30d)}회`
        : "운영자 승인";
  return (
    <section aria-label="고정된 알림" className="-mx-5 mb-2 border-b border-rule bg-[#fff7fb] px-5 py-4">
      <p className="text-[12px] font-semibold text-pin">📌 고정</p>
      <p className="mt-1 text-[15px] font-semibold text-ink">이제 리스트로 수익을 낼 수 있어요</p>
      <p className="mt-1 text-[13px] leading-relaxed text-ink/80">
        {why}로 수익화 기준을 넘었어요. 리스트 편집 화면에서 ‘이 리스트로 수익화할 것이다’를 켜면, 그 리스트 화면에 실제로 보인 광고 수만큼
        광고 수익의 {m.rate_pct}%를 나눠 드려요.
      </p>
      <Link href="/" className="btn-primary mt-3 inline-flex !py-2 !text-[13px]">내 리스트에서 켜기</Link>
    </section>
  );
}
