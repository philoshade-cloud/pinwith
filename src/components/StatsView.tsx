"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { createChannelLink } from "@/lib/share";
import type { ListItem } from "@/lib/types";
import { Panel, PanelLoading } from "./shell/Panel";
import { useMapScene, useShell, type Scene } from "./shell/context";
import { useFormat, useT } from "@/lib/i18n/client";

type Stats = {
  totals: { open: number; tap: number; directions: number; google: number; naver: number; kakao: number; onsite: number; devices: number };
  daily: { d: string; open: number; act: number }[];
  lists: { id: string; title: string; slug: string; open: number; tap: number; act: number; onsite: number }[];
  items: { id: string; title: string; list: string; tap: number; act: number; onsite: number }[];
  links: { code: string; label: string | null; list: string | null; open: number }[];
  referrers: { host: string; open: number }[];
};

type MyList = {
  id: string;
  slug: string;
  title: string;
  list_items: { id: string; place_id: string; custom_title: string; places: { lat: number | null; lng: number | null } | null }[];
};

const PERIODS = [7, 30, 90] as const;

// /me/stats — 내 리스트 링크가 어떻게 쓰이는지: 열림, 장소 탭, 길찾기·지도 열기, 가게 근처에서 누름, 유입 경로
export function StatsView() {
  const t = useT();
  const { num: n } = useFormat();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { me, toast } = useShell();
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30);
  const [stats, setStats] = useState<Stats | null>(null);
  const [lists, setLists] = useState<MyList[]>([]);

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      router.replace("/login?next=/me/stats");
      return;
    }
    const [{ data: s }, { data: l }] = await Promise.all([
      supabase.rpc("my_stats", { days }),
      supabase
        .from("lists")
        .select("id, slug, title, list_items(id, place_id, custom_title, places(lat, lng))")
        .eq("owner_id", auth.user.id)
        .order("updated_at", { ascending: false }),
    ]);
    setStats((s as Stats) ?? null);
    setLists((l as unknown as MyList[]) ?? []);
  }, [supabase, router, days]);

  useEffect(() => {
    const t = window.setTimeout(load, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  // 지도: 내 장소 핀. 핀 카드에 그 장소의 반응 수를 붙인다.
  const scene: Scene | null = useMemo(() => {
    if (!stats) return null;
    const byItem = new Map(stats.items.map((i) => [i.id, i]));
    const listOf = new Map<string, MyList>();
    const items: ListItem[] = lists.flatMap((l) =>
      l.list_items.map((i, k) => {
        listOf.set(i.id, l);
        return {
          id: i.id, placeId: i.place_id, title: i.custom_title, memo: "", sectionId: null,
          position: k, tags: [], videoUrl: null, lat: i.places?.lat ?? null, lng: i.places?.lng ?? null,
        };
      }),
    );
    return {
      items,
      cardExtra: (i) => {
        const s = byItem.get(i.id);
        const l = listOf.get(i.id);
        return <PinCard days={days} s={s} href={l && me ? `/@${me.handle}/${l.slug}` : null} title={l?.title ?? ""} />;
      },
    };
  }, [stats, lists, days, me]);
  useMapScene(scene);

  if (!stats) return <PanelLoading />;
  const tot = stats.totals;
  const external = tot.directions + tot.google + tot.naver + tot.kakao;

  return (
    <Panel title={t("내 통계 · 최근 {n}일", { n: days })}>
      <div className="px-5 pb-10 pt-4">
        <div className="flex gap-1.5" role="group" aria-label={t("기간")}>
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={days === p}
              onClick={() => setDays(p)}
              className={`rounded-full px-3 py-1.5 text-[13px] font-semibold ${days === p ? "bg-ink text-white" : "bg-surface text-ink"}`}
            >
              {t("{n}일", { n: p })}
            </button>
          ))}
        </div>

        {/* 핵심 숫자 */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Tile label={t("링크 열림")} value={tot.open} hint={tot.devices ? t("기기 {n}대 이상", { n: n(tot.devices) }) : undefined} />
          <Tile label={t("장소 탭")} value={tot.tap} />
          <Tile label={t("길찾기·지도 열기")} value={external} />
          <Tile label={t("가게 근처에서 누름")} value={tot.onsite} hint={t("500m 안, 위치 허용한 경우만")} />
        </div>

        <Section title={t("날짜별 링크 열림")}>
          <DailyBars days={days} daily={stats.daily} />
        </Section>

        <Section title={t("어느 지도로 갔나")}>
          <Bars
            rows={[
              { label: t("구글 길찾기"), value: tot.directions },
              { label: t("구글 지도"), value: tot.google },
              { label: t("네이버 지도"), value: tot.naver },
              { label: t("카카오맵"), value: tot.kakao },
            ]}
          />
        </Section>

        <Section title={t("리스트별")}>
          {stats.lists.length === 0 ? (
            <Empty>{t("아직 리스트가 없습니다.")}</Empty>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-muted">
                  <th className="py-1.5 font-normal">{t("리스트")}</th>
                  <th className="py-1.5 text-right font-normal">{t("열림")}</th>
                  <th className="py-1.5 text-right font-normal">{t("반응")}</th>
                  <th className="py-1.5 text-right font-normal">{t("근처")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule border-t border-rule">
                {stats.lists.map((l) => (
                  <tr key={l.id}>
                    <td className="max-w-0 truncate py-2 pr-2">
                      {me ? <Link href={`/@${me.handle}/${l.slug}`} className="font-semibold text-ink">{l.title}</Link> : l.title}
                    </td>
                    <td className="py-2 text-right tabular-nums">{n(l.open)}</td>
                    <td className="py-2 text-right tabular-nums">{n(l.tap + l.act)}</td>
                    <td className="py-2 text-right tabular-nums">{n(l.onsite)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-2 text-[12px] text-muted">{t("반응 = 장소 탭 + 길찾기·지도 열기. 내가 연 것은 세지 않습니다.")}</p>
        </Section>

        <Section title={t("반응이 많은 장소")}>
          {stats.items.length === 0 ? (
            <Empty>{t("아직 기록이 없습니다.")}</Empty>
          ) : (
            <Bars rows={stats.items.slice(0, 8).map((i) => ({ label: i.title, value: i.tap + i.act, note: i.onsite ? t("근처 {n}", { n: n(i.onsite) }) : undefined }))} />
          )}
        </Section>

        <Section title={t("어디서 들어왔나")}>
          {stats.referrers.length === 0 ? (
            <Empty>{t("아직 기록이 없습니다.")}</Empty>
          ) : (
            <Bars rows={stats.referrers.map((r) => ({ label: r.host.replace(/^www\./, ""), value: r.open }))} />
          )}
          <p className="mt-2 text-[12px] text-muted">
            {t("인스타그램·카톡 같은 앱 안에서 열면 출처가 안 남는 경우가 많습니다. 아래 채널별 링크를 쓰면 정확히 나눠 셀 수 있어요.")}
          </p>
        </Section>

        <ChannelLinks
          lists={lists}
          links={stats.links}
          onCreated={() => {
            toast(t("채널 링크를 만들었습니다."));
            load();
          }}
        />
      </div>
    </Panel>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-[14px] font-semibold text-ink">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-2 text-[14px] text-muted">{children}</p>;
}

// 지도 핀 카드: 그 장소의 최근 반응 수
function PinCard({ days, s, href, title }: { days: number; s: { tap: number; act: number; onsite: number } | undefined; href: string | null; title: string }) {
  const t = useT();
  const { num: n } = useFormat();
  return (
    <div className="text-[13px] text-ink/80">
      <p>
        {t("최근 {n}일:", { n: days })} {t("탭")} <b>{n(s?.tap ?? 0)}</b> · {t("길찾기·지도 열기")} <b>{n(s?.act ?? 0)}</b> · {t("가게 근처")} <b>{n(s?.onsite ?? 0)}</b>
      </p>
      {href && (
        <Link href={href} className="mt-2 flex font-semibold text-teal">
          {t("‘{title}’ 열기", { title })} <span className="ml-auto">›</span>
        </Link>
      )}
    </div>
  );
}

function Tile({ label, value, hint }: { label: string; value: number; hint?: string }) {
  const { num: n } = useFormat();
  return (
    <div className="rounded-xl bg-surface p-3">
      <p className="text-[12px] text-muted">{label}</p>
      <p className="font-display mt-0.5 text-[26px] font-semibold leading-none tabular-nums text-ink">{n(value)}</p>
      {hint && <p className="mt-1 text-[11px] text-muted">{hint}</p>}
    </div>
  );
}

// 가로 막대: 한 가지 색, 값은 글자 색으로(막대 색을 글자에 쓰지 않음)
function Bars({ rows }: { rows: { label: string; value: number; note?: string }[] }) {
  const { num: n } = useFormat();
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="grid gap-1.5">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[minmax(0,7.5rem)_1fr_auto] items-center gap-2 text-[13px]">
          <span className="truncate text-ink/80" title={r.label}>{r.label}</span>
          <span className="h-2.5 rounded-r bg-surface">
            <span className="block h-full rounded-r bg-pin" style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
          <span className="tabular-nums text-ink">
            {n(r.value)}
            {r.note && <span className="ml-1 text-[11px] text-teal">{r.note}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

// 날짜별 막대(한 계열): 빈 날짜도 0으로 채우고, 누르거나 올리면 그날 숫자를 보여준다
function DailyBars({ days, daily }: { days: number; daily: Stats["daily"] }) {
  const t = useT();
  const { num: n, date } = useFormat();
  const series = useMemo(() => {
    const byDay = new Map(daily.map((d) => [d.d, d]));
    const out: { d: string; open: number; act: number }[] = [];
    const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
    for (let k = days - 1; k >= 0; k--) {
      const dt = new Date(today);
      dt.setDate(today.getDate() - k);
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
      out.push(byDay.get(key) ?? { d: key, open: 0, act: 0 });
    }
    return out;
  }, [days, daily]);
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...series.map((s) => s.open));
  const W = 360, H = 110, gap = days > 60 ? 1 : 2;
  const bw = (W - gap * (series.length - 1)) / series.length;
  const label = (d: string) => date(new Date(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10))), { month: "short", day: "numeric" });
  const h = hover != null ? series[hover] : null;

  return (
    <div>
      <p className="h-5 text-[12px] text-muted" aria-live="polite">
        {h ? (
          <>
            {label(h.d)} · {t("열림")} <b className="text-ink">{n(h.open)}</b> · {t("길찾기·지도 열기")} <b className="text-ink">{n(h.act)}</b>
          </>
        ) : (
          <>{t("하루 최대 {n}회", { n: n(max) })}</>
        )}
      </p>
      <svg viewBox={`0 0 ${W} ${H + 1}`} className="mt-1 w-full" role="img" aria-label={t("최근 {n}일 날짜별 링크 열림", { n: days })} onMouseLeave={() => setHover(null)}>
        <line x1="0" x2={W} y1={H + 0.5} y2={H + 0.5} stroke="var(--color-rule)" />
        {series.map((s, i) => {
          const bh = s.open === 0 ? 0 : Math.max(3, (s.open / max) * (H - 4));
          const x = i * (bw + gap);
          return (
            <g key={s.d} onMouseEnter={() => setHover(i)} onClick={() => setHover(i)}>
              {/* 막대보다 넓은 누름 영역 */}
              <rect x={x} y={0} width={bw + gap} height={H} fill="transparent" />
              {bh > 0 && (
                <rect
                  x={x}
                  y={H - bh}
                  width={bw}
                  height={bh}
                  rx={Math.min(2, bw / 2)}
                  fill="var(--color-pin)"
                  opacity={hover == null || hover === i ? 1 : 0.45}
                />
              )}
              <title>{`${label(s.d)}: ${t("열림")} ${n(s.open)}`}</title>
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-muted">
        <span>{label(series[0].d)}</span>
        <span>{t("오늘")}</span>
      </div>
    </div>
  );
}

function ChannelLinks({
  lists, links, onCreated,
}: {
  lists: MyList[];
  links: Stats["links"];
  onCreated: () => void;
}) {
  const t = useT();
  const { num: n } = useFormat();
  const [listId, setListId] = useState(lists[0]?.id ?? "");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const titleOf = new Map(lists.map((l) => [l.id, l.title]));
  const origin = typeof window === "undefined" ? "" : window.location.origin;

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const target = listId || lists[0]?.id;
    if (!target || !label.trim() || busy) return;
    setBusy(true);
    const code = await createChannelLink(target, label);
    setBusy(false);
    if (code) {
      setLabel("");
      onCreated();
    }
  }

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(`${origin}/s/${code}`);
      setCopied(code);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      /* 복사 불가 */
    }
  }

  return (
    <Section title={t("채널별 링크")}>
      <p className="text-[12px] text-muted">
        {t("같은 리스트라도 인스타 프로필, 유튜브 설명란, 카톡 오픈채팅마다 다른 링크를 쓰면 어디서 몇 명이 왔는지 따로 셉니다.")}
      </p>
      {lists.length > 0 && (
        <form onSubmit={create} className="mt-3 grid gap-2 rounded-xl border border-rule p-3">
          <select value={listId || lists[0]?.id} onChange={(e) => setListId(e.target.value)} className="field" aria-label={t("리스트")}>
            {lists.map((l) => (
              <option key={l.id} value={l.id}>{l.title}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={40} placeholder={t("채널 이름 (예: 인스타 프로필)")} className="field" aria-label={t("채널 이름")} />
            <button type="submit" disabled={busy || !label.trim()} className="btn-primary shrink-0 disabled:opacity-40">{t("만들기")}</button>
          </div>
        </form>
      )}
      {links.length > 0 && (
        <ul className="mt-3 divide-y divide-rule border-y border-rule">
          {links.map((l) => (
            <li key={l.code} className="flex items-center gap-2 py-2.5 text-[13px]">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-ink">{l.label || t("기본 공유 링크")}</span>
                <span className="block truncate text-[12px] text-muted">
                  /s/{l.code}
                  {l.list && titleOf.get(l.list) && ` · ${titleOf.get(l.list)}`}
                </span>
              </span>
              <span className="shrink-0 tabular-nums text-ink">{t("열림")} {n(l.open)}</span>
              <button type="button" onClick={() => copy(l.code)} className="btn-quiet shrink-0 !px-2.5 !py-1 !text-[12px]">
                {copied === l.code ? t("복사됨") : t("복사")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
