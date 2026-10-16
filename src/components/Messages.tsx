"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ago, TAGS } from "@/lib/social";
import { Panel, PanelLoading } from "./shell/Panel";
import { useShell } from "./shell/context";
import { ConfirmButton } from "./ConfirmButton";

type InboxRow = {
  id: string;
  status: "active" | "request" | "blocked";
  other_id: string;
  other_handle: string;
  other_name: string;
  last_body: string | null;
  last_at: string | null;
  unread: number;
};

// 받은 메시지함(3.8): 대화 / 메시지 요청(내가 팔로우하지 않는 사람)으로 나눈다
export function Inbox() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<InboxRow[] | null>(null);
  const [tab, setTab] = useState<"active" | "request">("active");

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return router.replace("/login?next=/messages");
      const { data } = await supabase.rpc("my_inbox");
      setRows((data as InboxRow[]) ?? []);
    })();
  }, [supabase, router]);

  if (!rows) return <PanelLoading />;
  const requests = rows.filter((r) => r.status === "request");
  const shown = rows.filter((r) => (tab === "request" ? r.status === "request" : r.status === "active"));

  return (
    <Panel title="메시지">
      <div className="px-5 pb-8 pt-4">
        <div className="flex gap-1.5" role="tablist">
          {(["active", "request"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`rounded-full px-3 py-1.5 text-[13px] font-semibold ${tab === t ? "bg-ink text-white" : "bg-surface text-ink"}`}
            >
              {t === "active" ? "대화" : `메시지 요청${requests.length ? ` ${requests.length}` : ""}`}
            </button>
          ))}
        </div>
        {tab === "request" && (
          <p className="mt-3 text-[12px] text-muted">내가 팔로우하지 않는 사람이 보낸 메시지예요. 수락하기 전에는 읽음 표시가 가지 않아요.</p>
        )}
        {shown.length === 0 ? (
          <p className="py-8 text-[14px] text-muted">
            {tab === "active" ? "아직 대화가 없어요. 리스트나 장소에서 ‘메시지’를 눌러 시작하세요." : "메시지 요청이 없어요."}
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-rule border-y border-rule">
            {shown.map((r) => (
              <li key={r.id}>
                <Link href={`/messages/${r.id}`} className="flex items-center gap-3 py-3 hover:bg-surface/60">
                  <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-teal text-[15px] font-semibold text-white">
                    {(r.other_name || r.other_handle).slice(0, 1)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className="truncate text-[15px] font-semibold text-ink">{r.other_name || r.other_handle}</span>
                      {r.last_at && <span className="shrink-0 text-[11px] text-muted">{ago(r.last_at)}</span>}
                    </span>
                    <span className={`block truncate text-[13px] ${r.unread ? "font-semibold text-ink" : "text-muted"}`}>
                      {r.last_body || "첨부한 카드"}
                    </span>
                  </span>
                  {r.unread > 0 && (
                    <span className="shrink-0 rounded-full bg-pin px-2 py-0.5 text-[11px] font-semibold text-white">{r.unread}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}

type Msg = {
  id: string;
  sender_id: string;
  body: string;
  tag: string | null;
  resolved_at: string | null;
  created_at: string;
  list: { id: string; title: string; slug: string; owner: { handle: string } | null } | null;
  item: { id: string; custom_title: string } | null;
};

type Attach = { listId?: string; itemId?: string; label: string };

// 대화 화면. 4초마다 새 메시지를 확인한다. 리스트·장소 카드를 붙여 보낼 수 있다.
export function Conversation({ id }: { id: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { me, toast, refreshBadges } = useShell();
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [other, setOther] = useState<{ id: string; handle: string; display_name: string } | null>(null);
  const [myStatus, setMyStatus] = useState<"active" | "request" | "blocked">("active");
  const [text, setText] = useState("");
  const [tag, setTag] = useState("");
  const [attach, setAttach] = useState<Attach | null>(null);
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  // 리스트·장소 화면에서 왔으면 그 카드를 붙여 둔다
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const listId = q.get("list") ?? undefined;
    const itemId = q.get("item") ?? undefined;
    if (!listId && !itemId) return;
    (async () => {
      let label = "";
      if (itemId) {
        const { data } = await supabase.from("list_items").select("custom_title").eq("id", itemId).maybeSingle();
        label = data?.custom_title ?? "장소";
      } else if (listId) {
        const { data } = await supabase.from("lists").select("title").eq("id", listId).maybeSingle();
        label = data?.title ?? "리스트";
      }
      setAttach({ listId, itemId, label });
    })();
  }, [supabase]);

  const load = useCallback(async () => {
    if (!me) return;
    const [{ data: members }, { data: m }] = await Promise.all([
      supabase
        .from("conversation_members")
        .select("user_id, status, profile:profiles!conversation_members_user_id_fkey(id, handle, display_name)")
        .eq("conversation_id", id),
      supabase
        .from("messages")
        .select(
          "id, sender_id, body, tag, resolved_at, created_at, list:lists!messages_attached_list_id_fkey(id, title, slug, owner:profiles!lists_owner_id_fkey(handle))," +
            " item:list_items!messages_attached_item_id_fkey(id, custom_title)",
        )
        .eq("conversation_id", id)
        .order("created_at", { ascending: true })
        .limit(300),
    ]);
    const ms = (members ?? []) as unknown as { user_id: string; status: "active" | "request" | "blocked"; profile: { id: string; handle: string; display_name: string } }[];
    if (ms.length === 0) {
      setMsgs([]);
      return;
    }
    const mine = ms.find((x) => x.user_id === me.id);
    setMyStatus(mine?.status ?? "active");
    setOther(ms.find((x) => x.user_id !== me.id)?.profile ?? null);
    setMsgs((m as unknown as Msg[]) ?? []);
    // 요청 상태에서는 읽음 표시를 남기지 않는다
    if (mine?.status === "active") {
      await supabase.from("conversation_members").update({ last_read_at: new Date().toISOString() }).eq("conversation_id", id).eq("user_id", me.id);
      refreshBadges();
    }
  }, [supabase, me, id, refreshBadges]);

  useEffect(() => {
    if (me === null) router.replace(`/login?next=/messages/${id}`);
    const t0 = window.setTimeout(load, 0);
    const t = window.setInterval(load, 4000);
    return () => {
      window.clearTimeout(t0);
      window.clearInterval(t);
    };
  }, [load, me, router, id]);

  const count = msgs?.length ?? 0;
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [count]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!me || busy || (!text.trim() && !attach)) return;
    setBusy(true);
    const { error } = await supabase.from("messages").insert({
      conversation_id: id,
      sender_id: me.id,
      body: text.trim().slice(0, 4000),
      tag: tag || null,
      attached_list_id: attach?.listId ?? null,
      attached_item_id: attach?.itemId ?? null,
    });
    setBusy(false);
    if (error) return toast(error.message.includes("blocked") ? "이 대화에는 보낼 수 없습니다." : "보내지 못했습니다.");
    setText("");
    setTag("");
    setAttach(null);
    load();
  }

  // 받은 사람(보통 큐레이터)이 '반영함'을 누르면 보낸 사람에게 "리스트가 업데이트됐어요" 알림
  async function resolve(messageId: string) {
    const { error } = await supabase.rpc("resolve_message", { p_message: messageId });
    if (error) return toast("처리하지 못했습니다.");
    toast("반영했다고 알렸어요.");
    load();
  }

  async function setStatus(status: "active" | "blocked") {
    if (!me) return;
    await supabase.from("conversation_members").update({ status }).eq("conversation_id", id).eq("user_id", me.id);
    toast(status === "active" ? "메시지 요청을 수락했습니다." : "차단했습니다. 더는 메시지를 주고받을 수 없어요.");
    load();
  }

  if (!msgs) return <PanelLoading />;
  const name = other?.display_name || other?.handle || "대화";

  return (
    <Panel title={`메시지 · ${name}`}>
      <div className="flex min-h-full flex-col">
        <div className="flex items-center gap-2 border-b border-rule px-5 py-2.5 text-[13px]">
          <Link href="/messages" className="text-muted hover:text-ink">← 메시지함</Link>
          {other && <Link href={`/@${other.handle}`} className="ml-auto font-semibold text-teal">@{other.handle}</Link>}
        </div>
        {myStatus !== "blocked" && (
          <div className="flex justify-end px-5 pt-2 text-[13px]">
            <ConfirmButton
              label="이 사람 차단"
              question="이 사람을 차단할까요? 차단하면 이 사람의 메시지를 더 받지 않아요."
              confirmLabel="차단"
              onConfirm={() => setStatus("blocked")}
              className="text-muted underline"
            />
          </div>
        )}
        {myStatus === "request" && (
          <div className="mx-5 mt-3 rounded-xl bg-surface p-3 text-[13px]">
            <p className="text-ink">내가 팔로우하지 않는 사람이 보낸 메시지 요청이에요.</p>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => setStatus("active")} className="btn-primary !py-1.5">수락</button>
              <button type="button" onClick={() => setStatus("blocked")} className="btn-quiet !py-1.5">차단</button>
            </div>
          </div>
        )}
        <ul className="flex-1 space-y-2 px-5 py-4">
          {msgs.length === 0 && <li className="text-[13px] text-muted">첫 메시지를 보내 보세요.</li>}
          {msgs.map((m) => {
            const mine = m.sender_id === me?.id;
            const tagLabel = TAGS.find((t) => t.id === m.tag)?.label;
            return (
              <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-[14px] ${mine ? "bg-ink text-white" : "bg-surface text-ink"}`}>
                  {tagLabel && <p className={`mb-1 text-[11px] font-semibold ${mine ? "text-white/70" : "text-teal"}`}>#{tagLabel}</p>}
                  {(m.list || m.item) && (
                    <Link
                      href={m.list?.owner ? `/@${m.list.owner.handle}/${m.list.slug}` : "#"}
                      className={`mb-1 block rounded-lg px-2.5 py-1.5 text-[13px] ${mine ? "bg-white/15" : "bg-white"}`}
                    >
                      📍 {m.item ? `${m.item.custom_title} · ` : ""}{m.list?.title}
                    </Link>
                  )}
                  {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                  {m.tag && (m.resolved_at ? (
                    <p className={`mt-1 text-[11px] font-semibold ${mine ? "text-white/80" : "text-teal"}`}>✓ 리스트에 반영함</p>
                  ) : !mine ? (
                    <button type="button" onClick={() => resolve(m.id)} className="mt-1.5 rounded-full bg-white px-2.5 py-1 text-[12px] font-semibold text-teal shadow-[inset_0_0_0_1px_var(--color-rule)]">
                      반영함
                    </button>
                  ) : null)}
                  <p className={`mt-0.5 text-right text-[10px] ${mine ? "text-white/60" : "text-muted"}`}>{ago(m.created_at)}</p>
                </div>
              </li>
            );
          })}
          <div ref={bottom} />
        </ul>
        {myStatus !== "blocked" ? (
          <form onSubmit={send} className="sticky bottom-0 grid gap-2 border-t border-rule bg-white px-5 py-3">
            {attach && (
              <span className="flex items-center gap-2 rounded-lg bg-surface px-2.5 py-1.5 text-[13px]">
                📍 {attach.label}
                <button type="button" onClick={() => setAttach(null)} className="ml-auto text-muted" aria-label="첨부 빼기">✕</button>
              </span>
            )}
            <div className="flex gap-1.5 overflow-x-auto" role="group" aria-label="메시지 유형">
              {TAGS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={tag === t.id}
                  onClick={() => setTag(tag === t.id ? "" : t.id)}
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold ${tag === t.id ? "bg-teal text-white" : "bg-surface text-ink"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={text} onChange={(e) => setText(e.target.value)} maxLength={4000} placeholder="메시지" aria-label="메시지" className="field" />
              <button type="submit" disabled={busy || (!text.trim() && !attach)} className="btn-primary shrink-0 disabled:opacity-40">보내기</button>
            </div>
          </form>
        ) : (
          <p className="border-t border-rule px-5 py-3 text-[13px] text-muted">차단된 대화입니다.</p>
        )}
      </div>
    </Panel>
  );
}
