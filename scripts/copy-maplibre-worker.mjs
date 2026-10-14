// MapLibre는 지도 계산용 워커 파일을 따로 불러온다. 번들 후에는 경로가 깨지므로
// 빌드 전에 public/으로 복사하고 앱에서 setWorkerUrl로 이 경로를 알려준다.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const pkgDir = dirname(require.resolve("maplibre-gl/package.json"));
mkdirSync("public", { recursive: true });
copyFileSync(join(pkgDir, "dist", "maplibre-gl-worker.mjs"), join("public", "maplibre-gl-worker.mjs"));
console.log("copied maplibre-gl-worker.mjs → public/");
