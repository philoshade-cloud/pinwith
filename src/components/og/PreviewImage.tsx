import { ImageResponse } from "next/og";
import { loadPreviewFonts, type Preview } from "@/lib/public";

export const OG_SIZE = { width: 1200, height: 630 };

// 링크 카드 그림: 왼쪽에 제목·큐레이터, 오른쪽에 핀 배치(작은 지도 모양).
export async function renderPreview(p: Preview | null, kind: "list" | "curator") {
  const title = p?.title ?? "PinWith";
  const sub = p
    ? !p.handle
      ? "링크로 받으면 로그인 없이 바로 지도에서"
      : kind === "list"
      ? `${p.curatorName} · 장소 ${p.count}곳`
      : `@${p.handle} · 장소 ${p.count}곳`
    : "아는 곳을 핀으로 꽂아, 링크 하나로";
  const themes = (p?.themes ?? []).slice(0, 4).map((t) => `#${t}`).join("  ");
  const text = `${title}${sub}${themes}PinWith0123456789·`;
  const fonts = await loadPreviewFonts(text, p?.lang ?? "ko");
  const rtl = /[\u0600-\u06ff]/.test(title);

  // 핀 좌표를 그림 안 상자(440×470)에 맞춘다
  const W = 440, H = 470, PAD = 40;
  const pins = p?.pins ?? [];
  const lats = pins.map((x) => x.lat), lngs = pins.map((x) => x.lng);
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  const spanLat = Math.max(maxLat - minLat, 0.002), spanLng = Math.max(maxLng - minLng, 0.002);
  const k = Math.min((W - PAD * 2) / spanLng, (H - PAD * 2) / spanLat);
  const pts = pins.slice(0, 60).map((x) => ({
    x: W / 2 + (x.lng - (minLng + maxLng) / 2) * k,
    y: H / 2 - (x.lat - (minLat + maxLat) / 2) * k,
  }));

  const draw = (withFonts: boolean) =>
    new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#ffffff", fontFamily: fonts.map((f) => `"${f.name}"`).join(", ") || undefined }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "64px 56px", width: 700 }}>
          <div style={{ display: "flex", fontSize: 34, color: "#e0146e", fontWeight: 700 }}>PinWith</div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: title.length > 18 ? 56 : 68, lineHeight: 1.15, color: "#18222f", fontWeight: 700, justifyContent: rtl ? "flex-end" : "flex-start", textAlign: rtl ? "right" : "left" }}>
              {title}
            </div>
            <div style={{ display: "flex", marginTop: 24, fontSize: 32, color: "#5b6878" }}>{sub}</div>
            {themes && <div style={{ display: "flex", marginTop: 16, fontSize: 28, color: "#0b5d6b" }}>{themes}</div>}
          </div>
        </div>
        <div style={{ display: "flex", margin: "80px 60px 80px 0", width: W, height: H, borderRadius: 32, background: "#e6efe9", position: "relative" }}>
          {p?.course && pts.length > 1 && (
            <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
              <polyline
                points={pts.map((q) => `${q.x},${q.y}`).join(" ")}
                fill="none"
                stroke="#e0146e"
                strokeWidth={5}
                strokeOpacity={0.6}
                strokeDasharray="14 10"
              />
            </svg>
          )}
          {pts.map((q, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: q.x - 18,
                top: q.y - 18,
                width: 36,
                height: 36,
                borderRadius: 18,
                background: "#e0146e",
                border: "5px solid #ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                fontSize: 16,
                fontWeight: 700,
              }}
            >
              {p?.course ? String(i + 1) : ""}
            </div>
          ))}
        </div>
      </div>
    ),
    withFonts && fonts.length
      ? { ...OG_SIZE, fonts: fonts.map((f) => ({ name: f.name, data: f.data, weight: 700 as const, style: "normal" as const })) }
      : OG_SIZE,
  );

  // 그림을 끝까지 만든 뒤 보낸다. 중간에 깨지면(글꼴 없는 글자 등) 제목 없이 기본 카드라도 보낸다.
  try {
    const buf = await draw(true).arrayBuffer();
    return new Response(buf, { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=3600" } });
  } catch {
    return renderFallback();
  }
}

function renderFallback() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#ffffff" }}>
        <div style={{ display: "flex", fontSize: 96, color: "#e0146e", fontWeight: 700 }}>PinWith</div>
      </div>
    ),
    OG_SIZE,
  );
}
