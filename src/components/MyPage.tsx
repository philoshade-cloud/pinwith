"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { createEmptyList } from "@/lib/lists";
import type { Visibility } from "@/lib/types";

type Profile = { id: string; handle: string; display_name: string; bio: string };
type MyList = {
  id: string;
  slug: string;
  title: string;
  visibility: Visibility;
  updated_at: string;
  list_items: { count: number }[];
};

const VIS: Record<Visibility, string> = { public: "공개", unlisted: "링크 공개", private: "나만 보기" };
const HANDLE_RE = /^[a-z0-9_]{3,24}$/;


export function MyPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [draft, setDraft] = useState<Profile | null>(null);
  const [lists, setLists] = useState<MyList[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.replace("/login?next=/me");
        return;
      }
      const [{ data: p }, { data: l }] = await Promise.all([
        supabase.from("profiles").select("id, handle, display_name, bio").eq("id", auth.user.id).single(),
        supabase
          .from("lists")
          .select("id, slug, title, visibility, updated_at, list_items(count)")
          .eq("owner_id", auth.user.id)
          .order("updated_at", { ascending: false }),
      ]);
      if (p) {
        // 로그인 직후(welcome)이고 핸들을 이미 정했으면 곧장 내 지도로 보낸다.
        const welcome = new URLSearchParams(window.location.search).has("welcome");
        const tempHandle = p.handle.startsWith("u") && p.handle.length > 20;
        if (welcome && !tempHandle) {
          router.replace(`/@${p.handle}`);
          return;
        }
        setProfile(p);
        setDraft(p);
      }
      setLists((l as unknown as MyList[]) ?? []);
    })();
  }, [router, supabase]);

  const needsHandle = profile?.handle.startsWith("u") && profile.handle.length > 20;
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
    // 저장하면 내 지도로 이동. 거기서 새 리스트를 만든다.
    router.push(`/@${handle}`);
  }

  async function createList() {
    setCreating(true);
    try {
      const id = await createEmptyList();
      router.push(`/me/lists/${id}`);
    } catch {
      setCreating(false);
      setMsg("리스트를 만들지 못했습니다. 새로고침 후 다시 시도하세요.");
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/");
  }

  if (!profile || !draft) return <p className="p-8 text-muted">불러오는 중</p>;

  return (
    <main className="mx-auto max-w-[640px] px-5 py-10">
      <div className="flex items-center">
        <Link href="/" className="font-display text-[18px] font-semibold text-pin">PinWith</Link>
        <button type="button" onClick={signOut} className="ml-auto text-[14px] text-muted hover:text-ink">
          로그아웃
        </button>
      </div>

      <section className="mt-10" aria-labelledby="profile-h">
        <h1 id="profile-h" className="font-display text-[30px] font-semibold tracking-[-0.02em] text-ink">
          내 프로필
        </h1>
        {needsHandle && (
          <p className="mt-2 text-[15px] text-teal">
            핸들을 정하면 내 지도의 주소가 됩니다: /@핸들. 나중에 언제든 바꿀 수 있습니다.
          </p>
        )}
        <form onSubmit={saveProfile} className="mt-5 grid gap-4">
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
                핸들은 언제든 바꿀 수 있습니다. 바꾸면 이전 주소로 공유한 링크는 열리지 않습니다.
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
              {needsHandle ? "저장하고 내 지도로" : "프로필 저장"}
            </button>
            <Link href={`/@${profile.handle}`} className="btn-quiet">
              내 지도 보기
            </Link>
            {msg && <span role="status" className="text-[14px] text-muted">{msg}</span>}
          </div>
        </form>
      </section>

      <section className="mt-14" aria-labelledby="lists-h">
        <div className="flex items-center">
          <h2 id="lists-h" className="text-[18px] font-semibold text-ink">내 리스트</h2>
          <button
            type="button"
            onClick={createList}
            disabled={creating}
            className="btn-primary ml-auto disabled:opacity-40"
          >
            새 리스트 만들기
          </button>
        </div>
        {lists.length === 0 ? (
          <p className="mt-4 text-[15px] text-muted">
            아직 리스트가 없습니다. 첫 리스트를 만들고 아는 장소를 담아보세요.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-rule border-y border-rule">
            {lists.map((l) => (
              <li key={l.id}>
                <Link href={`/me/lists/${l.id}`} className="flex items-baseline gap-3 py-4 hover:bg-surface/60">
                  <span className="min-w-0 flex-1 truncate text-[16px] font-semibold text-ink">{l.title}</span>
                  <span className="shrink-0 text-[13px] text-muted">
                    {VIS[l.visibility]} · {l.list_items[0]?.count ?? 0}곳
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
