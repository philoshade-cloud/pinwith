"use client";

import { useEffect, useRef, useState } from "react";
import { loadPlacesLibrary, type UiKitPlace } from "@/lib/google";
import { logUsage } from "@/lib/usage";
import { currentLang, useT } from "@/lib/i18n/client";
import { useSavedSearch, useScopes, type SavedHit } from "@/lib/savedSearch";
import { SavedHitRow, ScopeChips } from "./SavedHits";

export type FoundPlace = { id: string; name: string; address: string; lat: number; lng: number };

type Suggestion = { placeId: string; main: string; secondary: string };

// 구글 제안 요청은 글자마다 요금이 붙으므로: 2글자부터, 입력이 멈춘 뒤에만, 같은 검색어는 다시 묻지 않는다.
const MIN_GOOGLE_CHARS = 2;
const DEBOUNCE_MS = 350;


type PlacesLib = {
  AutocompleteSessionToken: new () => unknown;
  AutocompleteSuggestion: {
    fetchAutocompleteSuggestions: (req: Record<string, unknown>) => Promise<{
      suggestions: { placePrediction: { placeId: string; mainText?: { text: string }; secondaryText?: { text: string } } | null }[];
    }>;
  };
  Place: {
    searchByText: (req: Record<string, unknown>) => Promise<{
      places: {
        id: string;
        displayName?: string | null;
        formattedAddress?: string | null;
        location?: { lat: () => number; lng: () => number } | null;
      }[];
    }>;
  };
};

// 장소 검색창.
// 글자를 치면 제안 목록이 뜨고(고르면 그 장소 하나), 제안을 고르지 않고 Enter를 누르면
// 같은 검색어로 찾은 장소 여러 곳을 지도와 목록으로 보여준다.
export function PlaceSearchBox({
  onPick, onResults, near, onSavedPick, onSavedAll,
}: {
  onPick: (placeId: string) => void;
  onResults: (query: string, places: FoundPlace[]) => void;
  // 저장한 핀 검색(로그인했을 때): 결과를 고르면 그 장소·리스트로, '모두 보기'는 검색 화면으로
  onSavedPick?: (hit: SavedHit) => void;
  onSavedAll?: (query: string) => void;
  // 지금 보고 있는 지도 가운데. 이 근처 결과를 먼저 보여준다.
  near?: () => { lat: number; lng: number } | null;
}) {
  const t = useT();
  const lib = useRef<PlacesLib | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const token = useRef<unknown>(null);
  const timer = useRef<number | undefined>(undefined);
  const seq = useRef(0);
  const cache = useRef(new Map<string, Suggestion[]>());
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "off">("loading");
  const [text, setText] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [busy, setBusy] = useState(false);
  const saved = !!onSavedPick;
  const { scopes, toggle } = useScopes();
  const savedHits = useSavedSearch(text, scopes, 6, saved);
  const googleOn = status === "ready";

  useEffect(() => {
    let cancelled = false;
    loadPlacesLibrary()
      .then((l) => {
        if (cancelled) return;
        lib.current = l as unknown as PlacesLib;
        setStatus("ready");
      })
      .catch((e: Error) => !cancelled && setStatus(e?.message === "disabled" ? "off" : "error"));
    return () => {
      cancelled = true;
      window.clearTimeout(timer.current);
    };
  }, []);

  function bias() {
    const c = near?.();
    return c ? { center: c, radius: 30000 } : undefined;
  }

  function suggest(q: string) {
    window.clearTimeout(timer.current);
    const term = q.trim();
    if (term.length < MIN_GOOGLE_CHARS) {
      setSuggestions([]);
      return;
    }
    timer.current = window.setTimeout(async () => {
      const my = ++seq.current;
      const list = await googleSuggest(term);
      if (my !== seq.current) return;
      setSuggestions(list);
      setActive(-1);
      setOpen(true);
    }, DEBOUNCE_MS);
  }

  async function googleSuggest(q: string): Promise<Suggestion[]> {
    const hit = cache.current.get(q);
    if (hit) return hit;
    const L = lib.current;
    if (!L) return [];
    token.current ??= new L.AutocompleteSessionToken();
    try {
      const { suggestions: list } = await L.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: q,
        sessionToken: token.current,
        language: currentLang(),
        ...(bias() ? { locationBias: bias() } : {}),
      });
      const out = list
        .map((x) => x.placePrediction)
        .filter((x): x is NonNullable<typeof x> => !!x)
        .map((x): Suggestion => ({
          placeId: x.placeId, main: x.mainText?.text ?? "", secondary: x.secondaryText?.text ?? "",
        }));
      cache.current.set(q, out);
      return out;
    } catch {
      return [];
    }
  }

  function pick(s: Suggestion) {
    // 휴대폰 키보드를 내려 지도가 보이게 한다
    input.current?.blur();
    // 제안 세션 하나(글자 입력 ~ 고르기)가 요금 1건
    if (token.current) logUsage("autocomplete");
    token.current = null;
    setOpen(false);
    setText(s.main);
    onPick(s.placeId);
  }

  async function googleSearch(q: string): Promise<FoundPlace[]> {
    if (!lib.current) return [];
    try {
      const { places } = await lib.current.Place.searchByText({
        textQuery: q,
        fields: ["id", "displayName", "formattedAddress", "location"],
        language: currentLang(),
        maxResultCount: 15,
        ...(bias() ? { locationBias: bias() } : {}),
      });
      return places
        .filter((p) => p.location)
        .map((p) => ({
          id: p.id,
          name: p.displayName ?? "",
          address: p.formattedAddress ?? "",
          lat: p.location!.lat(),
          lng: p.location!.lng(),
        }));
    } catch {
      return [];
    }
  }

  async function searchAll() {
    const q = text.trim();
    if (!q || busy) return;
    window.clearTimeout(timer.current);
    seq.current++;
    input.current?.blur();
    setOpen(false);
    setBusy(true);
    try {
      logUsage("text_search");
      if (token.current) logUsage("autocomplete");
      onResults(q, await googleSearch(q));
    } finally {
      token.current = null;
      setBusy(false);
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && suggestions.length) {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (a + 1) % suggestions.length);
    } else if (e.key === "ArrowUp" && suggestions.length) {
      e.preventDefault();
      setActive((a) => (a <= 0 ? suggestions.length - 1 : a - 1));
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Enter") {
      e.preventDefault();
      // 화살표로 고른 제안이 있으면 그 장소, 아니면 검색어 전체로 찾기
      if (open && active >= 0 && suggestions[active]) pick(suggestions[active]);
      else if (!googleOn && saved && onSavedAll && text.trim()) {
        // 구글 검색이 꺼져 있으면 Enter는 저장한 핀 검색 화면으로
        input.current?.blur();
        setOpen(false);
        onSavedAll(text.trim());
      } else searchAll();
    }
  }

  return (
    <div className="relative">
      <div className="flex items-center">
        <input
          ref={input}
          type="search"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (saved) setOpen(!!e.target.value.trim());
            suggest(e.target.value);
          }}
          onKeyDown={onKey}
          onFocus={() => (suggestions.length || (saved && text.trim())) && setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          placeholder={
            saved
              ? googleOn || status === "loading" ? t("내 핀이나 장소 이름·주소로 검색") : t("내 핀에서 검색")
              : status === "off" ? t("장소 검색을 잠시 쉬고 있어요") : status === "error" ? t("장소 검색을 불러오지 못했습니다") : t("장소 이름이나 주소로 검색")
          }
          disabled={!saved && (status === "error" || status === "off")}
          enterKeyHint="search"
          role="combobox"
          aria-controls="place-suggestions"
          aria-label={t("장소 검색")}
          aria-autocomplete="list"
          aria-expanded={open}
          className="h-9 min-w-0 flex-1 bg-transparent px-2 text-[15px] text-ink outline-none placeholder:text-muted"
        />
        {busy && <span className="px-2 text-[13px] text-muted">{t("찾는 중")}</span>}
        {text && !busy && (
          <button
            type="button"
            onClick={() => {
              setText("");
              setSuggestions([]);
              setOpen(false);
            }}
            className="px-2 text-muted hover:text-ink"
            aria-label={t("검색어 지우기")}
          >
            ✕
          </button>
        )}
      </div>
      {open && (suggestions.length > 0 || (saved && text.trim())) && (
        <div className="absolute inset-x-0 top-full z-50 mt-1.5 max-h-[70dvh] overflow-y-auto overscroll-contain rounded-xl bg-white py-1 shadow-[0_8px_24px_rgba(24,34,47,0.2)]">
          {saved && text.trim() && (
            <section aria-label={t("내 핀에서")} className="border-b border-rule pb-1">
              <div className="flex flex-wrap items-center gap-2 px-3 pb-1 pt-1.5">
                <span className="text-[12px] font-semibold text-teal">{t("내 핀에서")}</span>
                <ScopeChips scopes={scopes} toggle={toggle} />
              </div>
              {scopes.length === 0 ? (
                <p className="px-3 py-1.5 text-[13px] text-muted">{t("찾을 범위를 하나 이상 고르세요.")}</p>
              ) : savedHits === null ? (
                <p className="px-3 py-1.5 text-[13px] text-muted">{t("찾는 중")}</p>
              ) : savedHits.length === 0 ? (
                <p className="px-3 py-1.5 text-[13px] text-muted">{t("저장한 핀 중에는 없어요.")}</p>
              ) : (
                <ul>
                  {savedHits.slice(0, 5).map((h) => (
                    <li key={`${h.kind}-${h.item_id ?? h.list_id}`}>
                      <SavedHitRow hit={h} q={text} onPick={(x) => {
                        input.current?.blur();
                        setOpen(false);
                        onSavedPick?.(x);
                      }} />
                    </li>
                  ))}
                </ul>
              )}
              {onSavedAll && savedHits && savedHits.length > 0 && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    input.current?.blur();
                    setOpen(false);
                    onSavedAll(text.trim());
                  }}
                  className="block w-full px-3 py-1.5 text-left text-[12px] font-semibold text-teal"
                >
                  {t("‘{q}’ 내 핀에서 모두 보기", { q: text.trim() })}
                </button>
              )}
            </section>
          )}
          {suggestions.length > 0 && (
            <ul id="place-suggestions" role="listbox" aria-label={t("Google 장소")}>
              {saved && <li className="px-3 pb-0.5 pt-1.5 text-[12px] font-semibold text-muted">{t("Google 장소")}</li>}
              {suggestions.map((s, i) => (
                <li key={s.placeId} role="option" aria-selected={i === active}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(s)}
                    className={`block w-full px-3 py-2 text-left ${i === active ? "bg-surface" : "hover:bg-surface/60"}`}
                  >
                    <span className="block truncate text-[15px] text-ink">{s.main}</span>
                    {s.secondary && <span className="block truncate text-[12px] text-muted">{s.secondary}</span>}
                  </button>
                </li>
              ))}
              <li className="flex items-center justify-between border-t border-rule px-3 py-1.5 text-[12px] text-muted">
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={searchAll} className="font-semibold text-teal">
                  {t("‘{q}’ 결과 모두 지도에 보기", { q: text.trim() })}
                </button>
                <span>Google</span>
              </li>
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export type LoadedPlace = { lat: number; lng: number; name: string };

// 구글 장소 카드(Places UI Kit 상세). 사진·평점·영업 여부를 구글이 그려주고, 좌표를 알려준다.
export function PlaceCard({ placeId, onLoaded }: { placeId: string; onLoaded: (p: LoadedPlace) => void }) {
  const slot = useRef<HTMLDivElement>(null);
  const request = useRef<(HTMLElement & { place: string | null }) | null>(null);
  const onLoadedRef = useRef(onLoaded);

  useEffect(() => {
    onLoadedRef.current = onLoaded;
  }, [onLoaded]);

  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    let cancelled = false;
    loadPlacesLibrary().then(() => {
      if (cancelled || !slot.current) return;
      const card = document.createElement("gmp-place-details-compact") as HTMLElement & { place?: UiKitPlace };
      card.setAttribute("orientation", "horizontal");
      card.style.colorScheme = "light";
      card.style.width = "100%";
      const req = document.createElement("gmp-place-details-place-request") as HTMLElement & {
        place: string | null;
      };
      const config = document.createElement("gmp-place-content-config");
      for (const tag of [
        "gmp-place-media",
        "gmp-place-rating",
        "gmp-place-type",
        "gmp-place-open-now-status",
        "gmp-place-attribution",
      ]) {
        config.append(document.createElement(tag));
      }
      card.append(req, config);
      card.addEventListener("gmp-load", () => {
        logUsage("maps_card");
        const loc = card.place?.location;
        if (!loc) return;
        onLoadedRef.current({ lat: loc.lat(), lng: loc.lng(), name: card.place?.displayName ?? "" });
      });
      slot.current.replaceChildren(card);
      request.current = req;
      req.place = placeId;
    }).catch(() => {
      // 구글 장소 기능이 꺼졌거나 불러오지 못하면 카드 자리를 비운다(장소 이름·메모는 그대로 보임)
      if (!cancelled) setUnavailable(true);
    });
    return () => {
      cancelled = true;
    };
    // 카드는 한 번만 만들고, 장소가 바뀌면 아래 효과에서 요청만 바꾼다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (request.current) request.current.place = placeId;
  }, [placeId]);

  if (unavailable) return null;
  return <div ref={slot} className="min-h-[72px]" />;
}
