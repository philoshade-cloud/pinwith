"use client";
// 오래 열어 둔 탭(특히 휴대폰)은 예전 배포의 코드를 들고 있다. 그 상태로 다른 화면으로 가면
// 새 배포의 코드 조각과 섞여 "(0,h.f) is not a function" 같은 오류가 난다.
// 새 배포가 있는지 확인하고, 있으면 다음 이동을 새로 불러오기로 바꾼다.
export const BUILD_SHA = process.env.NEXT_PUBLIC_BUILD_SHA ?? "dev";

let stale = false;
let checkedAt = 0;
export const isStaleKnown = () => stale;

export async function checkStale(force = false): Promise<boolean> {
  if (stale || BUILD_SHA === "dev") return stale;
  if (!force && Date.now() - checkedAt < 5 * 60_000) return stale;
  checkedAt = Date.now();
  try {
    const r = await fetch("/api/build", { cache: "no-store" });
    const { sha } = (await r.json()) as { sha?: string };
    if (sha && sha !== "dev" && sha !== BUILD_SHA) stale = true;
  } catch {
    /* 오프라인 등: 모르면 그대로 */
  }
  return stale;
}

// 예전 배포 때문에 난 오류면 한 번만 새로 불러온다(1분 안에 또 나면 오류 화면을 보여 줌)
export function reloadOnceIfStale(): boolean {
  if (!stale) return false;
  try {
    const last = Number(sessionStorage.getItem("pw_stale_reload") || 0);
    if (Date.now() - last < 60_000) return false;
    sessionStorage.setItem("pw_stale_reload", String(Date.now()));
  } catch {
    return false;
  }
  location.reload();
  return true;
}
