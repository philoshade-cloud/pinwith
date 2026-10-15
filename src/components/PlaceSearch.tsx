"use client";

import { useEffect, useRef, useState } from "react";
import { loadPlacesLibrary, type UiKitPlace } from "@/lib/google";

export type FoundPlace = { id: string; name: string; address: string; lat: number; lng: number };

type Suggestion = { placeId: string; main: string; secondary: string };

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

// 구글 장소 검색창.
// 글자를 치면 제안 목록이 뜨고(고르면 그 장소 하나), 제안을 고르지 않고 Enter를 누르면
// 같은 검색어로 찾은 장소 여러 곳을 지도와 목록으로 보여준다.
export function PlaceSearchBox({
  onPick, onResults, near,
}: {
  onPick: (placeId: string) => void;
  onResults: (query: string, places: FoundPlace[]) => void;
  // 지금 보고 있는 지도 가운데. 이 근처 결과를 먼저 보여준다.
  near?: () => { lat: number; lng: number } | null;
}) {
  const lib = useRef<PlacesLib | null>(null);
  const token = useRef<unknown>(null);
  const timer = useRef<number | undefined>(undefined);
  const seq = useRef(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [text, setText] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadPlacesLibrary()
      .then((l) => {
        if (cancelled) return;
        lib.current = l as unknown as PlacesLib;
        setStatus("ready");
      })
      .catch(() => !cancelled && setStatus("error"));
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
    if (!q.trim() || !lib.current) {
      setSuggestions([]);
      return;
    }
    timer.current = window.setTimeout(async () => {
      const L = lib.current!;
      // 제안 요청을 한 번의 검색(세션)으로 묶어 과금을 줄인다
      token.current ??= new L.AutocompleteSessionToken();
      const my = ++seq.current;
      try {
        const { suggestions: list } = await L.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: q,
          sessionToken: token.current,
          language: "ko",
          ...(bias() ? { locationBias: bias() } : {}),
        });
        if (my !== seq.current) return;
        setSuggestions(
          list
            .map((x) => x.placePrediction)
            .filter((x): x is NonNullable<typeof x> => !!x)
            .map((x) => ({ placeId: x.placeId, main: x.mainText?.text ?? "", secondary: x.secondaryText?.text ?? "" })),
        );
        setActive(-1);
        setOpen(true);
      } catch {
        /* 제안 실패는 조용히 넘긴다 */
      }
    }, 220);
  }

  function pick(s: Suggestion) {
    token.current = null;
    setOpen(false);
    setText(s.main);
    onPick(s.placeId);
  }

  async function searchAll() {
    const q = text.trim();
    if (!q || !lib.current || busy) return;
    window.clearTimeout(timer.current);
    seq.current++;
    setOpen(false);
    setBusy(true);
    try {
      const { places } = await lib.current.Place.searchByText({
        textQuery: q,
        fields: ["id", "displayName", "formattedAddress", "location"],
        language: "ko",
        maxResultCount: 15,
        ...(bias() ? { locationBias: bias() } : {}),
      });
      onResults(
        q,
        places
          .filter((p) => p.location)
          .map((p) => ({
            id: p.id,
            name: p.displayName ?? "",
            address: p.formattedAddress ?? "",
            lat: p.location!.lat(),
            lng: p.location!.lng(),
          })),
      );
    } catch {
      onResults(q, []);
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
      else searchAll();
    }
  }

  return (
    <div className="relative">
      <div className="flex items-center">
        <input
          type="search"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            suggest(e.target.value);
          }}
          onKeyDown={onKey}
          onFocus={() => suggestions.length && setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          placeholder={status === "error" ? "장소 검색을 불러오지 못했습니다" : "장소 이름이나 주소로 검색"}
          disabled={status === "error"}
          enterKeyHint="search"
          role="combobox"
          aria-controls="place-suggestions"
          aria-label="장소 검색"
          aria-autocomplete="list"
          aria-expanded={open}
          className="h-9 min-w-0 flex-1 bg-transparent px-2 text-[15px] text-ink outline-none placeholder:text-muted"
        />
        {busy && <span className="px-2 text-[13px] text-muted">찾는 중</span>}
        {text && !busy && (
          <button
            type="button"
            onClick={() => {
              setText("");
              setSuggestions([]);
              setOpen(false);
            }}
            className="px-2 text-muted hover:text-ink"
            aria-label="지우기"
          >
            ✕
          </button>
        )}
      </div>
      {open && suggestions.length > 0 && (
        <ul id="place-suggestions" role="listbox" className="absolute inset-x-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl bg-white py-1 shadow-[0_8px_24px_rgba(24,34,47,0.2)]">
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
              ‘{text.trim()}’ 결과 모두 지도에 보기
            </button>
            <span>Google</span>
          </li>
        </ul>
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
        const loc = card.place?.location;
        if (!loc) return;
        onLoadedRef.current({ lat: loc.lat(), lng: loc.lng(), name: card.place?.displayName ?? "" });
      });
      slot.current.replaceChildren(card);
      request.current = req;
      req.place = placeId;
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

  return <div ref={slot} className="min-h-[72px]" />;
}
