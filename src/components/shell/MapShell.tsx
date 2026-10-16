"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/env";
import type { ListItem } from "@/lib/types";
import { track } from "@/lib/track";
import { PlaceSearchBox, type FoundPlace, type LoadedPlace } from "../PlaceSearch";
import { SaveToListSheet } from "../SaveToListSheet";
import { AddPlaceSheet } from "./AddPlaceSheet";
import { PinCard } from "./PinCard";
import { PlacePreview } from "./PlacePreview";
import { ConsentBanner } from "../Consent";
import { Logo } from "../Logo";
import { ShellContext, type Me, type MyList, type Scene, type Shell } from "./context";
import type { MapView } from "../PlaceMap";
import { useT } from "@/lib/i18n/client";

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
  const t = useT();
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
  // 검색으로 고른 장소: 먼저 미리보기(다른 지도 앱 버튼 + 저장), 저장을 누르면 저장 화면
  const [picked, setPicked] = useState<{ id: string; known?: LoadedPlace } | null>(null);
  const [saveAs, setSaveAs] = useState<LoadedPlace | null>(null);
  const [candidate, setCandidate] = useState<LoadedPlace | null>(null);
  const [searchKey, setSearchKey] = useState(0);
  // Enter로 찾은 여러 장소: 지도에 다른 색 핀으로, 버튼을 누르면 목록으로
  const [results, setResults] = useState<{ query: string; places: FoundPlace[] } | null>(null);
  const [resultsList, setResultsList] = useState(false);
  const centerOf = useRef<(() => { lat: number; lng: number }) | null>(null);
  const [view, setView] = useState<MapView | null>(null);
  // 핀 카드에서 리스트를 열 때 지도 위치를 지킬 장소(google place id)
  const pendingFocus = useRef<string | null>(null);
  const holdView = useRef<string | null>(null);
  const resultItems: ListItem[] = useMemo(
    () =>
      (results?.places ?? []).map((p, n) => ({
        id: p.id, placeId: p.id, title: p.name, memo: p.address, sectionId: null,
        position: n, tags: [], videoUrl: null, lat: p.lat, lng: p.lng,
      })),
    [results],
  );

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

  // ── 메시지·알림 숫자 ─────────────────────
  const [badges, setBadges] = useState({ messages: 0, notifications: 0 });
  const refreshBadges = useCallback(async () => {
    if (!supabase || !me) return;
    const [{ data: inbox }, { count }] = await Promise.all([
      supabase.rpc("my_inbox"),
      supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
    ]);
    const unread = ((inbox as { status: string; unread: number }[] | null) ?? []).reduce(
      (n, r) => n + (r.status === "blocked" ? 0 : Number(r.unread) || 0),
      0,
    );
    setBadges({ messages: unread, notifications: count ?? 0 });
  }, [supabase, me]);
  useEffect(() => {
    if (!me) return;
    const t0 = window.setTimeout(refreshBadges, 0);
    const t = window.setInterval(refreshBadges, 60000);
    return () => {
      window.clearTimeout(t0);
      window.clearInterval(t);
    };
  }, [me, refreshBadges]);

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
      if (!item.placeId) return toast(t("이 장소는 아직 구글 장소 정보와 연결되지 않아 담을 수 없습니다."));
      if (!me) {
        router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      setSaving(item);
    },
    [me, router, toast, t],
  );

  function closeAdd() {
    setPicked(null);
    setSaveAs(null);
    setCandidate(null);
    // 검색 결과를 보던 중이면 결과는 그대로 둔다(다른 곳도 이어서 담을 수 있게)
    if (!results) setSearchKey((k) => k + 1);
  }

  function showResults(query: string, places: FoundPlace[]) {
    setSelectedId(null);
    if (places.length === 0) {
      setResults(null);
      toast(t("‘{query}’로 찾은 장소가 없습니다.", { query }));
      return;
    }
    setResults({ query, places });
    setResultsList(false);
    if (window.innerWidth < 1024) setPanelOpen(false);
  }

  function pickResult(id: string) {
    const p = results?.places.find((x) => x.id === id);
    setSaveAs(null);
    const known = p ? { name: p.name, lat: p.lat, lng: p.lng } : undefined;
    setPicked({ id, known });
    setCandidate(known ?? null);
  }

  function closeResults() {
    setResults(null);
    setResultsList(false);
    setSearchKey((k) => k + 1);
  }

  const shell: Shell = {
    setScene, releaseScene, selectedId, select, panelOpen, setPanelOpen,
    me, myLists, refreshMine, toast, startSave, refreshBadges, view,
    focusNext: (placeId) => {
      pendingFocus.current = placeId;
      holdView.current = placeId;
    },
    takeFocus: () => {
      const p = pendingFocus.current;
      pendingFocus.current = null;
      return p;
    },
  };

  // ── 지도 여백: 패널·버튼에 가리지 않게 ─────────
  // 핀은 좌표 위쪽으로 30px쯤 솟으므로 위 여백을 그만큼 더 둔다.
  const padding = desktop
    ? { top: scene.toolbar && !results ? 160 : 128, bottom: 56, left: panelOpen || resultsList ? 448 : 40, right: 64 }
    : {
        top: scene.toolbar && !results ? 146 : 106,
        bottom: panelOpen || resultsList ? Math.round(h * 0.62) + 16 : 64 + 52 + 32 + (results ? 56 : 0),
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
          items={results ? resultItems : scene.items}
          selectedId={results ? null : selectedId}
          onSelect={results ? pickResult : select}
          showRoute={!results && !!scene.showRoute}
          numbering={results ? undefined : scene.numbering}
          tone={results ? "result" : "pin"}
          candidate={candidate}
          padding={padding}
          onReady={(get) => (centerOf.current = get)}
          onView={setView}
          holdViewRef={holdView}
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
          aria-label={t("PinWith 지도")}
          className="font-display hidden h-11 shrink-0 place-items-center rounded-xl bg-white px-3 text-[15px] font-semibold text-pin shadow-[0_2px_10px_rgba(24,34,47,0.15)] lg:grid"
        >
          <Logo size={24} />
        </Link>
        <div className="min-h-11 min-w-0 flex-1 rounded-xl bg-white p-1 shadow-[0_2px_10px_rgba(24,34,47,0.15)]">
          {me ? (
            <PlaceSearchBox
              key={searchKey}
              near={() => centerOf.current?.() ?? null}
              onResults={showResults}
              onPick={(id) => {
                setResults(null);
                setPicked({ id });
                setCandidate(null);
                setSelectedId(null);
              }}
            />
          ) : (
            <Link href="/explore" className="flex h-9 items-center px-2 text-[15px] text-muted">
              {me === undefined ? "" : t("타인의 핀 둘러보기")}
            </Link>
          )}
        </div>
        {me && (
          <>
            <IconLink href="/messages" label={t("메시지")} count={badges.messages}>✉</IconLink>
            <IconLink href="/notifications" label={t("알림")} count={badges.notifications}>🔔</IconLink>
          </>
        )}
      </div>

      {/* 데스크톱 메뉴 */}
      <Suspense fallback={<NavView variant="top" path="" {...navProps} />}>
        <Nav variant="top" {...navProps} />
      </Suspense>

      {/* 지도 도구(섹션 칩 등). 검색 결과를 볼 때는 숨긴다 */}
      {scene.toolbar && !results && (
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

      {/* 검색 결과: 요약 줄 + 목록 */}
      {results && !picked && (
        <>
          {resultsList && (
            <section
              aria-label={t("검색 결과")}
              className="fixed inset-x-0 bottom-16 top-[38dvh] z-[25] overflow-y-auto rounded-t-2xl bg-white pb-28 shadow-[0_-6px_24px_rgba(24,34,47,0.16)] lg:inset-x-auto lg:bottom-4 lg:left-4 lg:top-[76px] lg:w-[400px] lg:rounded-2xl lg:pb-16"
            >
              <ul className="divide-y divide-rule">
                {results.places.map((p) => (
                  <li key={p.id}>
                    <button type="button" onClick={() => pickResult(p.id)} className="block w-full px-5 py-3 text-left hover:bg-surface/60">
                      <span className="block text-[16px] font-semibold text-ink">{p.name}</span>
                      <span className="mt-0.5 block text-[13px] text-muted">{p.address}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="px-5 py-3 text-right text-[12px] text-muted">{t("Google 검색 결과")}</p>
            </section>
          )}
          <div className="fixed inset-x-2 bottom-[124px] z-30 flex items-center gap-2 rounded-2xl bg-ink px-4 py-2.5 text-white shadow-lg lg:bottom-6 lg:left-4 lg:right-auto lg:w-[400px]">
            <span className="min-w-0 flex-1 truncate text-[14px]">
              {t("‘{q}’ {n}곳 · 핀을 눌러 담기", { q: results.query, n: results.places.length })}
            </span>
            <button type="button" onClick={() => setResultsList(!resultsList)} className="shrink-0 rounded-full bg-white px-3 py-1 text-[13px] font-semibold text-ink">
              {resultsList ? t("지도") : t("목록")}
            </button>
            <button type="button" onClick={closeResults} className="shrink-0 px-1 text-white/80 hover:text-white" aria-label={t("검색 결과 닫기")}>
              ✕
            </button>
          </div>
        </>
      )}

      {/* 모바일 아래 메뉴 */}
      <Suspense fallback={<NavView variant="dock" path="" {...navProps} />}>
        <Nav variant="dock" {...navProps} />
      </Suspense>

      {picked && me && !saveAs && (
        <PlacePreview
          key={picked.id}
          placeId={picked.id}
          known={picked.known}
          onLoaded={setCandidate}
          onClose={closeAdd}
          onSave={setSaveAs}
        />
      )}

      {picked && me && saveAs && (
        <AddPlaceSheet
          key={picked.id}
          placeId={picked.id}
          place={saveAs}
          target={addTarget}
          onBack={() => setSaveAs(null)}
          onClose={closeAdd}
          onAdded={(listId, item, created) => {
            closeAdd();
            if (scene.addTarget && scene.addTarget.listId === listId) {
              scene.addTarget.onAdded(item);
              toast(t("{name}을(를) 저장했습니다.", { name: item.custom_title }));
            } else {
              const name = myLists.find((l) => l.id === listId)?.title ?? t("새 리스트");
              toast(t("{name}을(를) ‘{list}’에 저장했습니다.", { name: item.custom_title, list: name }));
              if (created) router.push(`/me/lists/${listId}`);
              else router.refresh();
            }
            refreshMine();
          }}
        />
      )}

      {saving && <SaveToListSheet item={saving} onClose={() => setSaving(null)} />}

      <ConsentBanner />

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

// 프로필(My) 메뉴 아이콘: 사람 모양
function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden className="block">
      <circle cx="12" cy="8" r="4.2" />
      <path d="M3.6 20.4c0-4.4 3.8-7.4 8.4-7.4s8.4 3 8.4 7.4c0 .6-.4.9-1 .9H4.6c-.6 0-1-.3-1-.9z" />
    </svg>
  );
}

function NavView({ variant, me, reopen, path }: NavProps & { path: string }) {
  const t = useT();
  const nav: { href: string; label: string; icon: React.ReactNode }[] = me
    ? [
        { href: "/", label: "지도", icon: "◎" },
        { href: "/explore", label: "타인의 핀", icon: "⌕" },
        { href: "/following", label: "팔로잉 리스트", icon: "♥" },
        { href: `/@${me.handle}`, label: "내 리스트", icon: "☰" },
        { href: "/me", label: "My", icon: <PersonIcon /> },
      ]
    : [
        { href: "/", label: "지도", icon: "◎" },
        { href: "/explore", label: "타인의 핀", icon: "⌕" },
        { href: "/demo", label: "예시", icon: "★" },
        { href: path && path !== "/login" ? `/login?next=${encodeURIComponent(path)}` : "/login", label: "로그인", icon: "→" },
      ];
  const base = (href: string) => href.split("?")[0];
  // 강조: 그 아래 화면에 있어도(예: 내 리스트 > 리스트 하나) 켠다
  const isActive = (href: string) => {
    const b = base(href);
    if (b === "/" || b === "/me") return path === b;
    if (me && b === `/@${me.handle}` && (path.startsWith("/me/lists/") || path === "/me/stats")) return true;
    return path === b || path.startsWith(b + "/");
  };
  // 정확히 그 화면일 때만 다시 누르면 패널 펼치기. 아래 화면에서 누르면 그 화면(목록)으로 간다.
  const onNav = (href: string) => (e: React.MouseEvent) => {
    if (path !== base(href)) return;
    e.preventDefault();
    reopen(href);
  };

  if (variant === "top") {
    return (
      <nav aria-label={t("메뉴")} className="fixed right-4 top-4 z-30 hidden gap-1 rounded-full bg-white p-1 shadow-[0_2px_10px_rgba(24,34,47,0.15)] lg:flex">
        {nav.map((n) => (
          <Link
            key={n.label}
            href={n.href}
            onClick={onNav(n.href)}
            aria-current={isActive(n.href) ? "page" : undefined}
            className={`rounded-full px-4 py-2 text-[14px] font-semibold ${isActive(n.href) ? "bg-ink text-white" : "text-ink hover:bg-surface"}`}
          >
            {t(n.label)}
          </Link>
        ))}
      </nav>
    );
  }
  return (
    <nav aria-label={t("메뉴")} className={`fixed inset-x-0 bottom-0 z-30 grid h-16 border-t ${nav.length === 5 ? "grid-cols-5" : "grid-cols-4"} border-rule bg-white pb-[env(safe-area-inset-bottom)] lg:hidden`}>
      {nav.map((n) => (
        <Link
          key={n.label}
          href={n.href}
          onClick={onNav(n.href)}
          aria-current={isActive(n.href) ? "page" : undefined}
          className={`flex flex-col items-center justify-center gap-0.5 whitespace-nowrap font-semibold tracking-[-0.02em] ${nav.length === 5 ? "text-[11px]" : "text-[12px]"} ${isActive(n.href) ? "text-pin" : "text-muted"}`}
        >
          <span aria-hidden className="text-[18px] leading-none">{n.icon}</span>
          {t(n.label)}
        </Link>
      ))}
    </nav>
  );
}

function IconLink({ href, label, count, children }: { href: string; label: string; count: number; children: ReactNode }) {
  const t = useT();
  return (
    <Link
      href={href}
      aria-label={count ? t("{label} {n}개 안 읽음", { label, n: count }) : label}
      className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-[18px] shadow-[0_2px_10px_rgba(24,34,47,0.15)]"
    >
      <span aria-hidden>{children}</span>
      {count > 0 && (
        <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-pin px-1 text-center text-[11px] font-semibold leading-5 text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
