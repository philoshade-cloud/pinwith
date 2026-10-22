// 리스트 카드의 작은 그림: 지도 대신 핀 위치만 점으로(서버에서 바로 그림, 지도 타일 없음)
export function PinThumb({ pins, course, size = 88 }: { pins: { lat: number; lng: number }[]; course?: boolean; size?: number }) {
  const pad = 14;
  const lats = pins.map((p) => p.lat);
  const lngs = pins.map((p) => p.lng);
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  // 가로·세로 같은 비율로(위도가 높을수록 경도 간격이 좁아지는 것도 맞춤)
  const k = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180));
  const span = Math.max((maxLng - minLng) * k, maxLat - minLat, 1e-4);
  const inner = size - pad * 2;
  const pts = pins.map((p) => ({
    x: pad + (((p.lng - minLng) * k) / span) * inner + (inner - ((maxLng - minLng) * k / span) * inner) / 2,
    y: pad + ((maxLat - p.lat) / span) * inner + (inner - ((maxLat - minLat) / span) * inner) / 2,
  }));
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden className="shrink-0 rounded-lg">
      <rect width={size} height={size} rx="10" fill="#e8f3f1" />
      <path d={`M0 ${size * 0.62} Q ${size * 0.4} ${size * 0.5} ${size} ${size * 0.7}`} stroke="#d3e7e3" strokeWidth="6" fill="none" />
      <path d={`M${size * 0.3} 0 Q ${size * 0.35} ${size * 0.5} ${size * 0.22} ${size}`} stroke="#dbece8" strokeWidth="4" fill="none" />
      {course && pts.length > 1 && (
        <polyline points={pts.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="#0b5d6b" strokeWidth="1.5" strokeDasharray="3 2" opacity="0.7" />
      )}
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="4" fill="#e0146e" stroke="#fff" strokeWidth="1.5" />
      ))}
    </svg>
  );
}
