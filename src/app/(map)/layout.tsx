import { MapShell } from "@/components/shell/MapShell";

// 지도가 바탕인 화면들. 이 레이아웃은 화면을 옮겨도 다시 그려지지 않아 지도가 그대로 유지된다.
export default function MapLayout({ children }: { children: React.ReactNode }) {
  return <MapShell>{children}</MapShell>;
}
