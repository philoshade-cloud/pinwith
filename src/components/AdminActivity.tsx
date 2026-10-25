"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { NO_TRACK_KEY } from "@/lib/track";

// 운영자 콘솔 '리스트 반응': 리스트별로 누가(익명) 들어와 무엇을 했는지. 리스트 주인·운영자 본인의 기록은 빠져 있다.
type Row = {
  id: string; title: string; slug: string; handle: string; visibility: string;
  views: number; visits: number; devices: number; members: number; taps: number; maps: number; videos: number; sections: number;
  shares: number; likes: number; follows: number; saves: number; avg_sec: number | null;
  first_at: string | null; last_at: string | null; countries: string | null; refs: string | null;
};
type Ev = {
  at: string; event: string; session: string | null; device: string | null; member: boolean; country: string | null;
  meta: Record<string, string | number> | null; place: string | null; ref: string | null;
};

const LABEL: Record<string, string> = {
  open: "첫 열림", view: "열람", leave: "떠남", tap: "장소 누름", directions: "길찾기", google_open: "구글 지도",
  naver_open: "네이버 지도", kakao_open: "카카오맵", video: "영상 장면", section: "섹션 바꿈", sort_near: "가까운 순",
  share: "공유", like: "좋아요", follow: "팔로우", save_place: "담기 누름",
};
const COLS: { key: keyof Row; label: string; hint: string }[] = [
  { key: "visits", label: "방문", hint: "한 번 들어와 이어서 본 것을 하나로 센 방문 수" },
  { key: "views", label: "열람", hint: "화면을 연 횟수(새로고침·재방문 포함)" },
  { key: "avg_sec", label: "평균 체류", hint: "방문 한 번에 화면을 보고 있던 시간" },
  { key: "taps", label: "장소 누름", hint: "목록·지도에서 장소를 누른 횟수" },
  { key: "maps", label: "지도·길찾기", hint: "길찾기·구글·네이버·카카오 지도 열기" },
  { key: "videos", label: "영상", hint: "'영상에서 보기'를 누른 횟수" },
  { key: "sections", label: "섹션", hint: "섹션 칩을 바꾼 횟수" },
  { key: "shares", label: "공유", hint: "공유 버튼" },
  { key: "likes", label: "좋아요", hint: "" },
  { key: "follows", label: "팔로우", hint: "" },
  { key: "saves", label: "담기", hint: "'내 리스트에 담기'를 누른 횟수" },
];

const kst = (s: string | null) =>
  s ? new Date(s).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
const dur = (sec: number | null) => (sec == null ? "" : sec < 60 ? `${sec}초` : `${Math.floor(sec / 60)}분 ${sec % 60}초`);

export function ActivityPanel() {
  const supabase = useMemo(() => createClient(), []);
  const [days, setDays] = useState(30);
  const [scope, setScope] = useState<"outreach" | "all">("outreach");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [events, setEvents] = useState<Ev[] | null>(null);
  const [mutedHere, setMutedHere] = useState(false);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMutedHere(localStorage.getItem(NO_TRACK_KEY) === "1");
    } catch {
      /* 저장소를 못 쓰면 끔으로 둔다 */
    }
  }, []);

  const load = useCallback(async () => {
    setRows(null);
    const { data } = await supabase.rpc("admin_list_activity", { p_days: days, p_scope: scope });
    setRows((data as Row[]) ?? []);
  }, [supabase, days, scope]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function toggle(id: string) {
    if (open === id) return setOpen(null);
    setOpen(id);
    setEvents(null);
    const { data } = await supabase.rpc("admin_list_events", { p_list: id, p_days: days });
    setEvents((data as Ev[]) ?? []);
  }

  function setMuted(v: boolean) {
    try {
      if (v) localStorage.setItem(NO_TRACK_KEY, "1");
      else localStorage.removeItem(NO_TRACK_KEY);
      setMutedHere(v);
    } catch {
      /* 무시 */
    }
  }

  function downloadCsv() {
    if (!rows) return;
    const head = ["리스트", "주소", ...COLS.map((c) => c.label), "나라", "유입", "처음", "마지막"];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = rows.map((r) =>
      [r.title, `https://pinwith.me/@${r.handle}/${r.slug}`, ...COLS.map((c) => r[c.key] ?? ""), r.countries, r.refs, r.first_at, r.last_at].map(esc).join(","),
    );
    const blob = new Blob(["﻿" + [head.map(esc).join(","), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `pinwith-list-activity-${scope}-${days}d.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const total = rows?.reduce((s, r) => s + r.visits, 0) ?? 0;
  const reached = rows?.filter((r) => r.visits > 0).length ?? 0;

  return (
    <section className="grid gap-3">
      <p className="text-[13px] text-muted">
        리스트에 들어온 사람이 무엇을 했는지 모아 봐요. 리스트 주인과 운영자 계정의 기록은 빠져 있어요. 로그인하지 않은 기기는 아래 ‘이 기기 기록 안 하기’를 켜면 빠져요.
        방문은 한 번 들어와 이어서 본 것을 하나로 세요(동의하지 않은 사람은 새로고침하면 새 방문). 같은 사람이 다시 왔는지는 ‘모두 허용’에 동의한 기기만 알 수 있어요.
      </p>
      <div className="flex flex-wrap items-center gap-2 text-[14px]">
        <select value={scope} onChange={(e) => setScope(e.target.value as "outreach" | "all")} className="field !w-auto">
          <option value="outreach">접근대상 리스트(공식 계정·링크 전용)</option>
          <option value="all">반응이 있는 모든 리스트</option>
        </select>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="field !w-auto">
          <option value={7}>최근 7일</option>
          <option value={30}>최근 30일</option>
          <option value={90}>최근 90일</option>
        </select>
        <button type="button" onClick={load} className="btn-quiet !py-1.5">새로고침</button>
        <button type="button" onClick={downloadCsv} className="btn-quiet !py-1.5" disabled={!rows?.length}>CSV 내려받기</button>
        <label className="ml-auto flex items-center gap-2">
          <input type="checkbox" checked={mutedHere} onChange={(e) => setMuted(e.target.checked)} /> 이 기기 기록 안 하기
        </label>
      </div>
      {rows && (
        <p className="text-[14px] text-ink">
          {rows.length}개 중 <b>{reached}개</b> 리스트에 방문이 있었고, 방문은 모두 <b>{total}번</b>이에요.
        </p>
      )}
      {!rows ? (
        <p className="text-muted">불러오는 중…</p>
      ) : rows.length === 0 ? (
        <p className="text-[14px] text-muted">아직 기록이 없어요.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-[13px]">
            <thead className="text-muted">
              <tr className="border-b border-rule">
                <th className="py-2 pr-3">리스트</th>
                {COLS.map((c) => (
                  <th key={c.key} title={c.hint} className="py-2 pr-3 text-right">{c.label}</th>
                ))}
                <th className="py-2 pr-3">나라</th>
                <th className="py-2 pr-3">유입</th>
                <th className="py-2">마지막</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <Fragment key={r.id}>
                  <tr
                    onClick={() => toggle(r.id)}
                    className={`cursor-pointer border-b border-rule hover:bg-surface/60 ${r.visits === 0 ? "text-muted" : "text-ink"}`}
                  >
                    <td className="max-w-[280px] py-2 pr-3">
                      <span className="mr-1 text-muted">{open === r.id ? "▾" : "▸"}</span>
                      <a href={`/@${r.handle}/${r.slug}`} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()} className="font-semibold underline-offset-2 hover:underline">
                        {r.title}
                      </a>
                      <span className="block truncate text-[12px] text-muted">@{r.handle}/{r.slug}</span>
                    </td>
                    {COLS.map((c) => (
                      <td key={c.key} className="py-2 pr-3 text-right tabular-nums">
                        {c.key === "avg_sec" ? dur(r.avg_sec) : Number(r[c.key] ?? 0) || ""}
                      </td>
                    ))}
                    <td className="py-2 pr-3">{r.countries}</td>
                    <td className="max-w-[160px] truncate py-2 pr-3">{r.refs}</td>
                    <td className="whitespace-nowrap py-2">{kst(r.last_at)}</td>
                  </tr>
                  {open === r.id && (
                    <tr className="border-b border-rule bg-surface/40">
                      <td colSpan={COLS.length + 4} className="px-3 py-3">
                        {!events ? (
                          <p className="text-muted">불러오는 중…</p>
                        ) : events.length === 0 ? (
                          <p className="text-muted">이 기간에는 기록이 없어요.</p>
                        ) : (
                          <ol className="grid gap-1">
                            {events.map((e, i) => (
                              <li key={i} className="flex flex-wrap gap-x-3 text-[13px]">
                                <span className="w-[92px] shrink-0 tabular-nums text-muted">{kst(e.at)}</span>
                                <span className="w-[72px] shrink-0 font-mono text-[12px] text-muted" title="방문(탭) 표시. 같은 값이면 같은 방문">
                                  {e.session ?? "—"}
                                </span>
                                <b className="w-[80px] shrink-0">{LABEL[e.event] ?? e.event}</b>
                                <span>
                                  {e.place}
                                  {e.event === "leave" && e.meta?.sec != null && ` ${dur(Number(e.meta.sec))} 보고 나감`}
                                  {e.event === "section" && e.meta?.name && ` ${e.meta.name}`}
                                  {e.event === "view" && (e.ref ? ` ← ${e.ref}` : " ← 직접·앱")}
                                </span>
                                <span className="text-muted">
                                  {[e.country, e.member ? "회원" : null, e.device ? `기기 ${e.device}` : null].filter(Boolean).join(" · ")}
                                </span>
                              </li>
                            ))}
                          </ol>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
