// 영어 사전: 한국어 문구 → 영어. 화면 영역별 파일을 합친다.
import { common } from "./common";
import { places } from "./places";
import { curator } from "./curator";
import { lists } from "./lists";
import { social } from "./social";
import { shell } from "./shell";
import { titles } from "./titles";

export const EN: Record<string, string> = { ...common, ...places, ...curator, ...lists, ...social, ...shell };
// 탭 제목은 따로(화면 문구와 같은 한국어라도 제목으로서의 영어를 쓴다)
export const TITLES: Record<string, string> = titles;
