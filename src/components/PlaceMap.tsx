"use client";

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MAP_STYLE_URL } from "@/lib/env";
import type { ListItem } from "@/lib/types";

type Props = {
  items: ListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  showRoute: boolean;
  // 코스 번호(전체 리스트 기준). 섹션으로 일부만 보여도 번호가 유지된다.
  numbering?: Map<string, number>;
  // 검색으로 고른, 아직 리스트에 넣지 않은 장소
  candidate?: { lat: number; lng: number } | null;
  // 지도를 가리는 패널·버튼 영역. 핀을 맞출 때 이만큼 비켜서 보여준다.
  padding?: { top: number; bottom: number; left: number; right: number };
};

const DEFAULT_PADDING = { top: 64, bottom: 64, left: 64, right: 64 };

// 가려진 영역을 뺀 나머지의 가운데로 옮기는 화면 이동량.
// (easeTo에 padding을 주면 지도에 계속 남아 다음 맞추기 때 여백이 겹치므로 offset을 쓴다)
function centerOffset(p: { top: number; bottom: number; left: number; right: number }): [number, number] {
  return [(p.left - p.right) / 2, (p.top - p.bottom) / 2];
}

// 큐레이터의 핀만 보여주는 가벼운 지도. 자세한 정보와 길찾기는 구글·네이버 지도로 넘긴다.
export function PlaceMap({
  items, selectedId, onSelect, showRoute, candidate = null, numbering, padding = DEFAULT_PADDING,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef(new Map<string, { marker: maplibregl.Marker; el: HTMLButtonElement }>());
  const candidateMarker = useRef<maplibregl.Marker | null>(null);
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  const located = items.filter((i) => i.lat != null && i.lng != null);

  useEffect(() => {
    if (!container.current || map.current) return;
    // 번들된 상태에서는 워커 경로를 스스로 찾지 못하므로 public/의 사본을 알려준다.
    if (!maplibregl.getWorkerUrl().startsWith(window.location.origin + "/maplibre")) {
      maplibregl.setWorkerUrl(`${window.location.origin}/maplibre-gl-worker.mjs`);
    }
    const m = new maplibregl.Map({
      container: container.current,
      style: MAP_STYLE_URL,
      center: [127, 30],
      zoom: 2.5,
      attributionControl: false,
    });
    // 모바일에서는 손가락으로 확대하므로 버튼을 두지 않고, 출처 표시는 위쪽(아래는 패널이 덮음)에 둔다.
    const narrow = window.innerWidth < 1024;
    m.addControl(new maplibregl.AttributionControl({ compact: true }), narrow ? "top-right" : "bottom-right");
    if (!narrow) m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    map.current = m;
    const pins = markers.current;
    return () => {
      m.remove();
      map.current = null;
      pins.clear();
    };
  }, []);

  // 핀 갱신 + 화면 맞추기
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    markers.current.forEach(({ marker }) => marker.remove());
    markers.current.clear();

    located.forEach((item, index) => {
      // 지도 라이브러리가 바깥 요소의 transform으로 위치를 잡으므로, 모양은 안쪽 요소에 그린다.
      const el = document.createElement("button");
      el.type = "button";
      el.className = "pin-wrap";
      el.setAttribute("aria-label", item.title);
      const shape = document.createElement("span");
      shape.className = "pin";
      if (showRoute) {
        const n = document.createElement("span");
        n.className = "pin-num";
        n.textContent = String(numbering?.get(item.id) ?? index + 1);
        shape.appendChild(n);
      }
      el.appendChild(shape);
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelectRef.current(item.id);
      });
      const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([item.lng!, item.lat!])
        .addTo(m);
      markers.current.set(item.id, { marker, el });
    });

    const drawRoute = () => {
      const id = "course-line";
      if (m.getLayer(id)) m.removeLayer(id);
      if (m.getSource(id)) m.removeSource(id);
      if (!showRoute || located.length < 2) return;
      m.addSource(id, {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: located.map((i) => [i.lng!, i.lat!]) },
        },
      });
      m.addLayer({
        id,
        type: "line",
        source: id,
        paint: { "line-color": "#E0146E", "line-width": 3, "line-opacity": 0.6, "line-dasharray": [2, 1.5] },
      });
    };
    if (m.isStyleLoaded()) drawRoute();
    else m.once("load", drawRoute);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, showRoute, numbering]);

  // 화면 맞추기: 핀이 바뀌거나 패널이 열리고 닫힐 때
  const padKey = `${padding.top},${padding.bottom},${padding.left},${padding.right}`;
  const fitted = useRef(false);
  useEffect(() => {
    const m = map.current;
    if (!m || located.length === 0) return;
    const bounds = new maplibregl.LngLatBounds();
    located.forEach((i) => bounds.extend([i.lng!, i.lat!]));
    // 화면이 작아 여백이 지도보다 크면 맞추기가 실패하므로 줄인다
    const c = m.getContainer();
    const pad = { ...padding };
    if (pad.top + pad.bottom > c.clientHeight - 80) {
      const k = Math.max(0, c.clientHeight - 80) / (pad.top + pad.bottom);
      pad.top *= k;
      pad.bottom *= k;
    }
    if (pad.left + pad.right > c.clientWidth - 80) {
      const k = Math.max(0, c.clientWidth - 80) / (pad.left + pad.right);
      pad.left *= k;
      pad.right *= k;
    }
    m.fitBounds(bounds, { padding: pad, maxZoom: 15, duration: fitted.current ? 500 : 0 });
    fitted.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, padKey]);

  // 선택 강조
  useEffect(() => {
    markers.current.forEach(({ el }, id) => {
      el.dataset.selected = id === selectedId ? "true" : "false";
    });
    const sel = selectedId ? located.find((i) => i.id === selectedId) : null;
    if (sel && map.current) {
      map.current.easeTo({ center: [sel.lng!, sel.lat!], offset: centerOffset(padding), duration: 400 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // 후보 장소: 다른 색 핀을 꽂고 그쪽으로 이동
  useEffect(() => {
    const m = map.current;
    candidateMarker.current?.remove();
    candidateMarker.current = null;
    if (!m || !candidate) return;
    const el = document.createElement("div");
    el.className = "pin-wrap";
    el.setAttribute("aria-hidden", "true");
    const shape = document.createElement("span");
    shape.className = "pin pin-candidate";
    el.appendChild(shape);
    candidateMarker.current = new maplibregl.Marker({ element: el, anchor: "bottom" })
      .setLngLat([candidate.lng, candidate.lat])
      .addTo(m);
    m.flyTo({ center: [candidate.lng, candidate.lat], zoom: Math.max(m.getZoom(), 15), offset: centerOffset(padding), duration: 600 });
  }, [candidate?.lat, candidate?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={container} className="h-full w-full" role="region" aria-label="장소 지도" />;
}
