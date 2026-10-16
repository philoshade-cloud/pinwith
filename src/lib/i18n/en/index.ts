// 영어 사전: 한국어 문구 → 영어. 화면 영역별 파일을 합친다.
import { common } from "./common";
import { places } from "./places";
import { curator } from "./curator";
import { lists } from "./lists";
import { social } from "./social";
import { shell } from "./shell";

export const EN: Record<string, string> = { ...common, ...places, ...curator, ...lists, ...social, ...shell };
