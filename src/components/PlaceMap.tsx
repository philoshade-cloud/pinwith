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
};

// 큐레이터의 핀만 보여주는 가벼운 지도. 자세한 정보와 길찾기는 구글·네이버 지도로 넘긴다.
export function PlaceMap({ items, selectedId, onSelect, showRoute }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef(new Map<string, { marker: maplibregl.Marker; el: HTMLButtonElement }>());
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
      center: [135.5, 34.67],
      zoom: 12,
      attributionControl: { compact: true },
    });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
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
      const el = document.createElement("button");
      el.type = "button";
      el.className = "pin";
      el.setAttribute("aria-label", item.title);
      if (showRoute) {
        const n = document.createElement("span");
        n.style.transform = "rotate(45deg)";
        n.textContent = String(index + 1);
        el.appendChild(n);
      }
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelectRef.current(item.id);
      });
      const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([item.lng!, item.lat!])
        .addTo(m);
      markers.current.set(item.id, { marker, el });
    });

    if (located.length > 0) {
      const bounds = new maplibregl.LngLatBounds();
      located.forEach((i) => bounds.extend([i.lng!, i.lat!]));
      const narrow = window.innerWidth < 1024;
      // 모바일에서는 위쪽 제목 줄과 아래쪽 지도/목록 전환 버튼을 피해서 맞춘다.
      m.fitBounds(bounds, {
        padding: narrow ? { top: 90, bottom: 110, left: 40, right: 40 } : 64,
        maxZoom: 15,
        duration: 0,
      });
    }

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
  }, [items, showRoute]);

  // 선택 강조
  useEffect(() => {
    markers.current.forEach(({ el }, id) => {
      el.dataset.selected = id === selectedId ? "true" : "false";
    });
    const sel = selectedId ? located.find((i) => i.id === selectedId) : null;
    if (sel && map.current) {
      map.current.easeTo({ center: [sel.lng!, sel.lat!], duration: 400 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  return <div ref={container} className="h-full w-full" role="region" aria-label="장소 지도" />;
}
