"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SignOutButton } from "./SignOutButton";
import { Panel, PanelLoading } from "./shell/Panel";
import { useShell } from "./shell/context";

type Profile = { id: string; handle: string; display_name: string; bio: string };
const HANDLE_RE = /^[a-z0-9_]{3,24}$/;
// 가입 때 자동으로 붙는 임시 핸들(u + 12자리)
const TEMP_HANDLE = /^u[0-9a-f]{12}$/;


export function MyPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { refreshMine } = useShell();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [draft, setDraft] = useState<Profile | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.replace("/login?next=/me");
        return;
      }
      const { data: p } = await supabase
        .from("profiles")
        .select("id, handle, display_name, bio")
        .eq("id", auth.user.id)
        .single();
      if (p) {
        // 로그인 직후(welcome)이고 핸들을 이미 정했으면 곧장 내 지도로 보낸다.
        const welcome = new URLSearchParams(window.location.search).has("welcome");
        const tempHandle = TEMP_HANDLE.test(p.handle);
        if (welcome && !tempHandle) {
          router.replace("/");
          return;
        }
        setProfile(p);
        setDraft(p);
      }
    })();
  }, [router, supabase]);

  const needsHandle = !!profile && TEMP_HANDLE.test(profile.handle);
  const dirty = draft && profile && JSON.stringify(draft) !== JSON.stringify(profile);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    const handle = draft.handle.trim().toLowerCase();
    if (!HANDLE_RE.test(handle)) {
      setMsg("핸들은 영문 소문자, 숫자, 밑줄(_)로 3~24자입니다.");
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .update({ handle, display_name: draft.display_name.trim(), bio: draft.bio.trim() })
      .eq("id", draft.id);
    if (error) {
      setMsg(error.code === "23505" ? "이미 누가 쓰고 있는 핸들입니다." : "저장하지 못했습니다. 다시 시도하세요.");
      return;
    }
    const saved = { ...draft, handle, display_name: draft.display_name.trim(), bio: draft.bio.trim() };
    setProfile(saved);
    setDraft(saved);
    // 저장하면 지도(홈)로 돌아간다
    await refreshMine();
    router.push("/");
  }

  async function deleteAccount() {
    if (!window.confirm("계정을 삭제할까요? 내 리스트와 장소, 팔로우, 좋아요가 모두 지워지며 되돌릴 수 없습니다.")) return;
    const { error } = await supabase.rpc("delete_my_account");
    if (error) {
      setMsg("계정을 삭제하지 못했습니다. 잠시 후 다시 시도하세요.");
      return;
    }
    await supabase.auth.signOut();
    await refreshMine();
    router.replace("/");
  }

  if (!profile || !draft) return <PanelLoading />;

  return (
    <Panel title="내 프로필">
      <div className="px-5 pb-8 pt-4">
        {needsHandle && (
          <p className="rounded-lg bg-surface px-3 py-2 text-[14px] text-teal">
            핸들을 정하면 내 지도의 주소가 됩니다: /@핸들. 나중에 언제든 바꿀 수 있습니다.
          </p>
        )}
        <form onSubmit={saveProfile} className="mt-4 grid gap-4">
          <label className="grid gap-1 text-[13px] font-semibold text-ink">
            핸들
            <span className="flex items-center rounded-lg border border-rule bg-surface pl-3 text-[15px] font-normal text-muted focus-within:outline-2 focus-within:outline-teal">
              @
              <input
                value={draft.handle}
                onChange={(e) => setDraft({ ...draft, handle: e.target.value })}
                className="min-w-0 flex-1 rounded-r-lg bg-white px-2 py-2.5 text-ink outline-none"
                autoComplete="username"
              />
            </span>
            {!needsHandle && (
              <span className="text-[12px] font-normal text-muted">
                핸들을 바꾸면 이전 주소로 공유한 링크는 열리지 않습니다.
              </span>
            )}
          </label>
          <label className="grid gap-1 text-[13px] font-semibold text-ink">
            이름
            <input
              value={draft.display_name}
              onChange={(e) => setDraft({ ...draft, display_name: e.target.value })}
              maxLength={40}
              className="field"
            />
          </label>
          <label className="grid gap-1 text-[13px] font-semibold text-ink">
            소개
            <textarea
              value={draft.bio}
              onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
              rows={2}
              maxLength={200}
              className="field"
              placeholder="어떤 곳을 소개하는 사람인가요?"
            />
          </label>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={!dirty && !needsHandle} className="btn-primary disabled:opacity-40">
              저장하고 지도로
            </button>
            {msg && <span role="status" className="text-[14px] text-muted">{msg}</span>}
          </div>
        </form>

        <div className="mt-10 grid gap-2 border-t border-rule pt-6">
          {!needsHandle && (
            <Link href={`/@${profile.handle}`} className="btn-quiet justify-center">
              내 리스트 보기
            </Link>
          )}
          <SignOutButton className="btn-quiet justify-center" />
        </div>

        <div className="mt-10 border-t border-rule pt-6 text-[13px] text-muted">
          <p>
            <Link href="/privacy" className="underline">개인정보처리방침</Link>
            {" · "}
            <Link href="/terms" className="underline">이용약관</Link>
          </p>
          <button type="button" onClick={deleteAccount} className="mt-4 font-semibold text-pin hover:underline">
            계정 삭제
          </button>
          <p className="mt-1">내 프로필, 리스트, 팔로우, 좋아요가 모두 지워지며 되돌릴 수 없습니다.</p>
        </div>
      </div>
    </Panel>
  );
}
