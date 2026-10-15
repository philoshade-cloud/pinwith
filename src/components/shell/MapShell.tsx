"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/env";
import type { ListItem } from "@/lib/types";
import { track } from "@/lib/track";
import { PlaceSearchBox, type LoadedPlace } from "../PlaceSearch";
import { SaveToListSheet } from "../SaveToListSheet";
import { AddPlaceSheet } from "./AddPlaceSheet";
import { PinCard } from "./PinCard";
import { ShellContext, type Me, type MyList, type Scene, type Shell } from "./context";

const PlaceMap = dynamic(() => import("../PlaceMap").then((m) => m.PlaceMap), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-[#e9eef0]" />,
});

const EMPTY: Scene = { items: [] };

function useViewport() {
  const [vp, setVp] = useState({ w: 1280, h: 800 });
  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return vp;
}

// 앱의 뼈대: 지도가 늘 바탕에 깔려 있고, 각 기능은 그 위의 패널로 열렸다가 접힌다.
export function MapShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const supabase = useMemo(() => (isSupabaseConfigured() ? createClient() : null), []);
  const { w, h } = useViewport();
  const desktop = w >= 1024;

  const [scene, setSceneState] = useState<Scene>(EMPTY);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [me, setMe] = useState<Me | null | undefined>(supabase ? undefined : null);
  const [myLists, setMyLists] = useState<MyList[]>([]);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState<ListItem | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [candidate, setCandidate] = useState<LoadedPlace | null>(null);
  const [searchKey, setSearchKey] = useState(0);

  // ── 로그인 상태와 내 리스트 ─────────────────
  const refreshMine = useCallback(async () => {
    if (!supabase) return;
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setMe(null);
      setMyLists([]);
      return;
    }
    const [{ data: p }, { data: l }] = await Promise.all([
      supabase.from("profiles").select("id, handle, display_name").eq("id", auth.user.id).maybeSingle(),
      supabase.from("lists").select("id, title").eq("owner_id", auth.user.id).order("updated_at", { ascending: false }),
    ]);
    setMe(p ? { id: p.id, handle: p.handle, displayName: p.display_name || p.handle } : null);
    setMyLists(l ?? []);
  }, [supabase]);

  useEffect(() => {
    if (!supabase) return;
    // 첫 확인은 다음 틱에: 효과 안에서 곧바로 상태를 바꾸지 않는다.
    const t = window.setTimeout(refreshMine, 0);
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") refreshMine();
    });
    return () => {
      window.clearTimeout(t);
      data.subscription.unsubscribe();
    };
  }, [supabase, refreshMine]);

  // ── 공용 동작 ───────────────────────────
  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => setToastMsg((m) => (m === msg ? null : m)), 3000);
  }, []);

  const setScene = useCallback((s: Scene) => setSceneState(s), []);
  const releaseScene = useCallback(
    () => setSceneState((prev) => ({ items: prev.items, showRoute: prev.showRoute, numbering: prev.numbering })),
    [],
  );

  const select = useCallback(
    (id: string | null) => {
      setSelectedId(id);
      if (!id) return;
      // 모바일에서는 패널을 접어 지도와 카드가 보이게 한다
      if (window.innerWidth < 1024) setPanelOpen(false);
      const item = scene.items.find((i) => i.id === id);
      const listId = item && scene.listIdOf?.(item);
      if (item && listId) track("tap", { listId, itemId: id, lat: item.lat, lng: item.lng });
    },
    [scene],
  );

  const startSave = useCallback(
    (item: ListItem) => {
      if (!item.placeId) return toast("이 장소는 아직 구글 장소 정보와 연결되지 않아 담을 수 없습니다.");
      if (!me) {
        router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      setSaving(item);
    },
    [me, router, toast],
  );

  function closeAdd() {
    setPicked(null);
    setCandidate(null);
    setSearchKey((k) => k + 1);
  }

  const shell: Shell = {
    setScene, releaseScene, selectedId, select, panelOpen, setPanelOpen,
    me, myLists, refreshMine, toast, startSave,
  };

  // ── 지도 여백: 패널·버튼에 가리지 않게 ─────────
  // 핀은 좌표 위쪽으로 30px쯤 솟으므로 위 여백을 그만큼 더 둔다.
  const padding = desktop
    ? { top: scene.toolbar ? 160 : 128, bottom: 56, left: panelOpen ? 448 : 40, right: 64 }
    : {
        top: scene.toolbar ? 146 : 106,
        bottom: panelOpen ? Math.round(h * 0.62) + 16 : 64 + 52 + 32,
        left: 28,
        right: 28,
      };

  const selected = selectedId ? scene.items.find((i) => i.id === selectedId) ?? null : null;
  const addTarget = scene.addTarget
    ? ({ mode: "fixed", listId: scene.addTarget.listId, sections: scene.addTarget.sections } as const)
    : ({ mode: "pick", lists: myLists } as const);

  // 지금 화면의 메뉴를 다시 누르면 패널을 펼친다(지도 메뉴는 패널을 접는다)
  const reopen = useCallback((href: string) => {
    setPanelOpen(href !== "/");
    setSelectedId(null);
  }, []);
  const navProps = { me, reopen };

  return (
    <ShellContext.Provider value={shell}>
      {/* 바탕 지도 */}
      <div className="fixed inset-0">
        <PlaceMap
          items={scene.items}
          selectedId={selectedId}
          onSelect={select}
          showRoute={!!scene.showRoute}
          numbering={scene.numbering}
          candidate={candidate}
          padding={padding}
        />
      </div>

      {/* 위쪽: 로고 + 장소 검색 */}
      <div className="fixed inset-x-0 top-0 z-30 flex items-start gap-2 p-2 lg:left-4 lg:right-auto lg:top-4 lg:w-[400px] lg:p-0">
        <Link
          href="/"
          onClick={(e) => {
            if (window.location.pathname === "/") {
              e.preventDefault();
              reopen("/");
            }
          }}
          aria-label="PinWith 지도"
          className="font-display grid h-11 shrink-0 place-items-center rounded-xl bg-white px-3 text-[15px] font-semibold text-pin shadow-[0_2px_10px_rgba(24,34,47,0.15)]"
        >
          <span className="lg:hidden">P</span>
          <span className="hidden lg:inline">PinWith</span>
        </Link>
        <div className="min-h-11 min-w-0 flex-1 rounded-xl bg-white p-1 shadow-[0_2px_10px_rgba(24,34,47,0.15)]">
          {me ? (
            <PlaceSearchBox key={searchKey} onPick={(id) => { setPicked(id); setCandidate(null); setSelectedId(null); }} />
          ) : (
            <Link href="/explore" className="flex h-9 items-center px-2 text-[15px] text-muted">
              {me === undefined ? "" : "큐레이터·리스트 찾기"}
            </Link>
          )}
        </div>
      </div>

      {/* 데스크톱 메뉴 */}
      <Suspense fallback={<NavView variant="top" path="" {...navProps} />}>
        <Nav variant="top" {...navProps} />
      </Suspense>

      {/* 지도 도구(섹션 칩 등) */}
      {scene.toolbar && (
        <div className="fixed inset-x-0 top-[60px] z-20 px-2 pr-12 lg:left-[432px] lg:right-auto lg:top-[76px] lg:max-w-[calc(100vw-460px)] lg:pr-0">
          {scene.toolbar}
        </div>
      )}

      {/* 기능 패널 */}
      {children}

      {/* 핀 카드 */}
      {selected && !picked && (desktop || !panelOpen) && (
        <div className="fixed inset-x-2 bottom-[124px] z-30 lg:bottom-6 lg:left-[432px] lg:right-auto lg:w-[380px]">
          <PinCard
            item={selected}
            listId={scene.listIdOf?.(selected)}
            onClose={() => setSelectedId(null)}
            onSave={startSave}
            extra={scene.cardExtra?.(selected)}
          />
        </div>
      )}

      {/* 모바일 아래 메뉴 */}
      <Suspense fallback={<NavView variant="dock" path="" {...navProps} />}>
        <Nav variant="dock" {...navProps} />
      </Suspense>

      {picked && me && (
        <AddPlaceSheet
          key={picked}
          placeId={picked}
          target={addTarget}
          onLoaded={setCandidate}
          onClose={closeAdd}
          onAdded={(listId, item, created) => {
            closeAdd();
            if (scene.addTarget && scene.addTarget.listId === listId) {
              scene.addTarget.onAdded(item);
              toast(`${item.custom_title}을(를) 추가했습니다.`);
            } else {
              const name = myLists.find((l) => l.id === listId)?.title ?? "새 리스트";
              toast(`${item.custom_title}을(를) ‘${name}’에 추가했습니다.`);
              if (created) router.push(`/me/lists/${listId}`);
              else router.refresh();
            }
            refreshMine();
          }}
        />
      )}

      {saving && <SaveToListSheet item={saving} onClose={() => setSaving(null)} />}

      {toastMsg && (
        <div role="status" className="fixed inset-x-0 top-[64px] z-50 mx-auto w-fit max-w-[90vw] rounded-full bg-ink px-4 py-2 text-[14px] text-white lg:top-5">
          {toastMsg}
        </div>
      )}
    </ShellContext.Provider>
  );
}

type NavProps = { variant: "top" | "dock"; me: Me | null | undefined; reopen: (href: string) => void };

// 주소를 읽는 부분은 Suspense 안에 둔다(정적 뼈대는 주소 없이 그린다).
function Nav(props: NavProps) {
  return <NavView {...props} path={decodeURIComponent(usePathname())} />;
}

function NavView({ variant, me, reopen, path }: NavProps & { path: string }) {
  const nav = me
    ? [
        { href: "/", label: "지도", icon: "◎" },
        { href: "/explore", label: "찾기", icon: "⌕" },
        { href: `/@${me.handle}`, label: "내 리스트", icon: "☰" },
        { href: "/me", label: "프로필", icon: "◐" },
      ]
    : [
        { href: "/", label: "지도", icon: "◎" },
        { href: "/explore", label: "찾기", icon: "⌕" },
        { href: "/demo", label: "예시", icon: "★" },
        { href: path && path !== "/login" ? `/login?next=${encodeURIComponent(path)}` : "/login", label: "로그인", icon: "→" },
      ];
  const isActive = (href: string) => {
    const base = href.split("?")[0];
    return base === "/" ? path === "/" : path === base || path.startsWith(base + "/");
  };
  const onNav = (href: string) => (e: React.MouseEvent) => {
    if (!isActive(href)) return;
    e.preventDefault();
    reopen(href);
  };

  if (variant === "top") {
    return (
      <nav aria-label="메뉴" className="fixed right-4 top-4 z-30 hidden gap-1 rounded-full bg-white p-1 shadow-[0_2px_10px_rgba(24,34,47,0.15)] lg:flex">
        {nav.map((n) => (
          <Link
            key={n.label}
            href={n.href}
            onClick={onNav(n.href)}
            aria-current={isActive(n.href) ? "page" : undefined}
            className={`rounded-full px-4 py-2 text-[14px] font-semibold ${isActive(n.href) ? "bg-ink text-white" : "text-ink hover:bg-surface"}`}
          >
            {n.label}
          </Link>
        ))}
      </nav>
    );
  }
  return (
    <nav aria-label="메뉴" className="fixed inset-x-0 bottom-0 z-30 grid h-16 grid-cols-4 border-t border-rule bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
      {nav.map((n) => (
        <Link
          key={n.label}
          href={n.href}
          onClick={onNav(n.href)}
          aria-current={isActive(n.href) ? "page" : undefined}
          className={`flex flex-col items-center justify-center gap-0.5 text-[12px] font-semibold ${isActive(n.href) ? "text-pin" : "text-muted"}`}
        >
          <span aria-hidden className="text-[18px] leading-none">{n.icon}</span>
          {n.label}
        </Link>
      ))}
    </nav>
  );
}
