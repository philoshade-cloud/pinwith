"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useShell } from "./shell/context";

type Invite = {
  list_id: string;
  accepted_at: string | null;
  list: { title: string; slug: string; owner: { handle: string; display_name: string } | null } | null;
};

// 내가 공동 편집자인 리스트와 받은 초대(3.10). 내 지도 화면에 보인다.
export function CoEditedLists() {
  const supabase = useMemo(() => createClient(), []);
  const { me, toast } = useShell();
  const [rows, setRows] = useState<Invite[]>([]);

  const load = useCallback(async () => {
    if (!me) return;
    const { data } = await supabase
      .from("list_editors")
      .select("list_id, accepted_at, list:lists(title, slug, owner:profiles!lists_owner_id_fkey(handle, display_name))")
      .eq("user_id", me.id)
      .order("created_at", { ascending: false });
    setRows((data as unknown as Invite[]) ?? []);
  }, [supabase, me]);

  useEffect(() => {
    const t = window.setTimeout(load, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  async function answer(listId: string, accept: boolean) {
    if (!me) return;
    const q = accept
      ? supabase.from("list_editors").update({ accepted_at: new Date().toISOString() }).eq("list_id", listId).eq("user_id", me.id)
      : supabase.from("list_editors").delete().eq("list_id", listId).eq("user_id", me.id);
    const { error } = await q;
    if (error) return toast("처리하지 못했습니다.");
    toast(accept ? "공동 편집자가 됐습니다." : "초대를 거절했습니다.");
    load();
  }

  if (rows.length === 0) return null;
  return (
    <section className="border-t border-rule px-5 py-4" aria-labelledby="coedit-h">
      <h2 id="coedit-h" className="text-[13px] font-semibold text-teal">함께 편집하는 리스트</h2>
      <ul className="mt-2 grid gap-2">
        {rows.map((r) => (
          <li key={r.list_id} className="flex items-center gap-2 text-[14px]">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold text-ink">{r.list?.title}</span>
              <span className="block truncate text-[12px] text-muted">
                {r.list?.owner?.display_name || r.list?.owner?.handle}의 리스트{!r.accepted_at && " · 초대받음"}
              </span>
            </span>
            {r.accepted_at ? (
              <>
                <Link href={`/@${r.list?.owner?.handle}/${r.list?.slug}`} className="btn-quiet shrink-0 !px-3">보기</Link>
                <Link href={`/me/lists/${r.list_id}`} className="btn-quiet shrink-0 !px-3">편집</Link>
              </>
            ) : (
              <>
                <button type="button" onClick={() => answer(r.list_id, true)} className="btn-primary shrink-0 !px-3">수락</button>
                <button type="button" onClick={() => answer(r.list_id, false)} className="btn-quiet shrink-0 !px-3">거절</button>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

type Editor = {
  user_id: string;
  accepted_at: string | null;
  revenue_share_pct: number;
  user: { handle: string; display_name: string } | null;
};
type Person = { id: string; handle: string; display_name: string };

// 리스트 편집 화면: 공동 편집자 관리(주인만). 서로 팔로우하는 사람만 초대할 수 있다.
export function EditorsManager({ listId }: { listId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const { me, toast } = useShell();
  const [editors, setEditors] = useState<Editor[]>([]);
  const [mutuals, setMutuals] = useState<Person[]>([]);
  const [pick, setPick] = useState("");

  const load = useCallback(async () => {
    if (!me) return;
    const [{ data: e }, { data: following }, { data: followers }] = await Promise.all([
      supabase
        .from("list_editors")
        .select("user_id, accepted_at, revenue_share_pct, user:profiles!list_editors_user_id_fkey(handle, display_name)")
        .eq("list_id", listId),
      supabase.from("follows").select("followee:profiles!follows_followee_id_fkey(id, handle, display_name)").eq("follower_id", me.id),
      supabase.from("follows").select("follower_id").eq("followee_id", me.id),
    ]);
    setEditors((e as unknown as Editor[]) ?? []);
    const back = new Set((followers ?? []).map((f) => f.follower_id as string));
    setMutuals(
      ((following ?? []) as unknown as { followee: Person }[]).map((f) => f.followee).filter((p) => p && back.has(p.id)),
    );
  }, [supabase, me, listId]);

  useEffect(() => {
    const t = window.setTimeout(load, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  async function invite() {
    if (!me || !pick) return;
    const { error } = await supabase.from("list_editors").insert({ list_id: listId, user_id: pick, invited_by: me.id });
    if (error) return toast("초대하지 못했습니다. 서로 팔로우하는 사이인지 확인하세요.");
    setPick("");
    toast("초대를 보냈습니다.");
    load();
  }

  async function remove(userId: string) {
    if (!window.confirm("이 사람을 공동 편집자에서 뺄까요?")) return;
    await supabase.from("list_editors").delete().eq("list_id", listId).eq("user_id", userId);
    load();
  }

  async function setShare(userId: string, pct: number) {
    const v = Math.max(0, Math.min(100, Math.round(pct)));
    await supabase.from("list_editors").update({ revenue_share_pct: v }).eq("list_id", listId).eq("user_id", userId);
  }

  const candidates = mutuals.filter((m) => !editors.some((e) => e.user_id === m.id));

  return (
    <section className="mt-10" aria-labelledby="editors-h">
      <h2 id="editors-h" className="text-[15px] font-semibold text-ink">공동 편집자</h2>
      <p className="mt-1 text-[13px] text-muted">
        서로 팔로우하는 사람을 초대하면 함께 장소를 추가·이동·삭제하고 메모를 씁니다. 공개 범위와 주소는 주인만 바꿉니다.
      </p>
      {editors.length > 0 && (
        <ul className="mt-3 divide-y divide-rule border-y border-rule">
          {editors.map((e) => (
            <li key={e.user_id} className="flex items-center gap-2 py-2.5 text-[14px]">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-ink">{e.user?.display_name || e.user?.handle}</span>
                <span className="block text-[12px] text-muted">{e.accepted_at ? "편집 중" : "초대 보냄"}</span>
              </span>
              <label className="flex shrink-0 items-center gap-1 text-[12px] text-muted" title="이 리스트에서 생기는 수익 중 이 사람 몫">
                수익
                <input
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={e.revenue_share_pct}
                  onBlur={(ev) => setShare(e.user_id, Number(ev.target.value))}
                  className="field !w-16 !px-2 !py-1"
                  aria-label="수익 배분(%)"
                />
                %
              </label>
              <button type="button" onClick={() => remove(e.user_id)} className="btn-quiet shrink-0 !px-2.5">빼기</button>
            </li>
          ))}
        </ul>
      )}
      {candidates.length > 0 ? (
        <div className="mt-3 flex gap-2">
          <select value={pick} onChange={(e) => setPick(e.target.value)} className="field" aria-label="초대할 사람">
            <option value="">서로 팔로우하는 사람 고르기</option>
            {candidates.map((m) => (
              <option key={m.id} value={m.id}>{m.display_name || m.handle} (@{m.handle})</option>
            ))}
          </select>
          <button type="button" onClick={invite} disabled={!pick} className="btn-primary shrink-0 disabled:opacity-40">초대</button>
        </div>
      ) : (
        <p className="mt-3 text-[13px] text-muted">초대할 수 있는 사람이 없습니다. 서로 팔로우하는 사이여야 해요.</p>
      )}
      <p className="mt-2 text-[12px] text-muted">수익 배분 기본값은 주인 100%입니다(나중에 수익화 기능에 쓰입니다).</p>
    </section>
  );
}
