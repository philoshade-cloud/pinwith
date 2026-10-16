"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import type { MapView } from "../PlaceMap";
import type { AddedItem } from "@/lib/lists";
import type { ListItem, Section } from "@/lib/types";

// 지도 하나를 모든 화면이 함께 쓴다. 각 화면(패널)은 지도에 무엇을 보여줄지(scene)를 알려준다.
export type Scene = {
  items: ListItem[];
  showRoute?: boolean;
  // 코스 번호(전체 리스트 기준). 섹션으로 일부만 보여도 번호가 유지된다.
  numbering?: Map<string, number>;
  // 지도 위쪽에 붙는 도구(예: 섹션 칩)
  toolbar?: ReactNode;
  // 핀 카드 아래에 덧붙일 버튼(예: 이 리스트 열기)
  cardExtra?: (item: ListItem) => ReactNode;
  // 기록용: 이 장소가 속한 리스트
  listIdOf?: (item: ListItem) => string | undefined;
  // 검색으로 고른 장소를 넣을 곳. 없으면 내 리스트 중에서 고른다.
  addTarget?: { listId: string; sections: Section[]; onAdded: (item: AddedItem) => void } | null;
};

export type Me = { id: string; handle: string; displayName: string };
export type MyList = { id: string; title: string };

export type Shell = {
  setScene: (scene: Scene) => void;
  releaseScene: () => void;
  selectedId: string | null;
  select: (id: string | null) => void;
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  // undefined: 아직 확인 중, null: 로그인 안 함
  me: Me | null | undefined;
  myLists: MyList[];
  refreshMine: () => Promise<void>;
  toast: (msg: string) => void;
  startSave: (item: ListItem) => void;
  // 위쪽 메시지·알림 아이콘의 숫자를 다시 센다
  refreshBadges: () => void;
  // 지금 지도에 보이는 지역(지도를 움직이면 바뀜). 아직 모르면 null
  view: MapView | null;
};

export const ShellContext = createContext<Shell | null>(null);

export function useShell() {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error("useShell must be used inside MapShell");
  return ctx;
}

// 화면이 지도에 보여줄 내용을 등록한다. scene은 useMemo로 만들어 넘긴다.
// 화면을 떠나면 핀은 그대로 두고(지도가 갑자기 비지 않도록) 동작만 풀어준다.
export function useMapScene(scene: Scene | null) {
  const { setScene, releaseScene } = useShell();
  useEffect(() => {
    if (scene) setScene(scene);
  }, [scene, setScene]);
  useEffect(() => releaseScene, [releaseScene]);
}
