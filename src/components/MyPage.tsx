"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SignOutButton } from "./SignOutButton";
import { AvatarPicker } from "./AvatarPicker";
import { PushToggle } from "./PushToggle";
import { ConfirmButton } from "./ConfirmButton";
import { APP_VERSION } from "@/lib/version";
import { useMonetization } from "@/lib/monetization";
import { Panel, PanelLoading } from "./shell/Panel";
import { useShell } from "./shell/context";
import { LangSwitch, useFormat, useT } from "@/lib/i18n/client";

type Profile = { id: string; handle: string; display_name: string; bio: string };
const HANDLE_RE = /^[a-z0-9_]{3,24}$/;
// 가입 때 자동으로 붙는 임시 핸들(u + 12자리)
const TEMP_HANDLE = /^u[0-9a-f]{12}$/;


const fmt = (v: number, c: string, locale: string) => {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency: c, maximumFractionDigits: 2 }).format(v);
  } catch {
    return `${v} ${c}`;
  }
};

function deleteQuestion(
  l: { currency: string; available: number; pending_payout: number; stores: { place_name: string; balance: number }[] } | null,
  t: ReturnType<typeof useT>,
  locale: string,
) {
  const warn: string[] = [];
  if (l && Number(l.pending_payout) > 0) warn.push(t("· 처리 중인 지급 요청 {amount}: 탈퇴하면 지급 정보가 지워져 보내 드릴 수 없어요. 지급을 받은 뒤 탈퇴하세요.", { amount: fmt(Number(l.pending_payout), l.currency, locale) }));
  if (l && Number(l.available) > 0) warn.push(t("· 아직 받지 않은 수익 {amount}: 탈퇴하면 받을 수 없어요. 상업 이용자용 콘솔에서 먼저 지급을 요청하세요.", { amount: fmt(Number(l.available), l.currency, locale) }));
  for (const b of l?.stores ?? []) warn.push(t("· {store} 광고비 잔액 {amount}: 탈퇴 전에 문의·신고하기로 환불을 요청하세요.", { store: b.place_name, amount: fmt(Number(b.balance), l!.currency, locale) }));
  const base = t("계정을 삭제할까요? 내 리스트와 장소, 팔로우, 좋아요, 가게·수익 기록이 모두 지워지며 되돌릴 수 없어요.");
  return warn.length ? `${base}\n\n${t("남은 돈이 있어요:")}\n${warn.join("\n")}` : base;
}

export function MyPage() {
  const t = useT();
  const { locale } = useFormat();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { refreshMine } = useShell();
  const money = useMonetization();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [draft, setDraft] = useState<Profile | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  // 탈퇴 전에 남은 돈 확인(받을 수익, 처리 중인 지급, 가게 광고비 잔액)
  const [leftover, setLeftover] = useState<{ currency: string; available: number; pending_payout: number; stores: { place_name: string; balance: number }[] } | null>(null);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.replace("/login?next=/me");
        return;
      }
      const { data: p } = await supabase
        .from("profiles")
        .select("id, handle, display_name, bio")
        .eq("id", auth.user.id)
        .single();
      if (p) {
        // 로그인 직후(welcome)이고 핸들을 이미 정했으면 곧장 내 지도로 보낸다.
        const welcome = new URLSearchParams(window.location.search).has("welcome");
        const tempHandle = TEMP_HANDLE.test(p.handle);
        if (welcome && !tempHandle) {
          router.replace("/");
          return;
        }
        setProfile(p);
        setDraft(p);
        const { data: chk } = await supabase.rpc("my_deletion_check");
        if (chk) setLeftover(chk as NonNullable<typeof leftover>);
      }
    })();
  }, [router, supabase]);

  const needsHandle = !!profile && TEMP_HANDLE.test(profile.handle);
  const dirty = draft && profile && JSON.stringify(draft) !== JSON.stringify(profile);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    const handle = draft.handle.trim().toLowerCase();
    if (!HANDLE_RE.test(handle)) {
      setMsg(t("핸들은 영문 소문자, 숫자, 밑줄(_)로 3~24자입니다."));
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .update({ handle, display_name: draft.display_name.trim(), bio: draft.bio.trim() })
      .eq("id", draft.id);
    if (error) {
      setMsg(error.code === "23505" ? t("이미 누가 쓰고 있는 핸들입니다.") : t("저장하지 못했습니다. 다시 시도하세요."));
      return;
    }
    const saved = { ...draft, handle, display_name: draft.display_name.trim(), bio: draft.bio.trim() };
    setProfile(saved);
    setDraft(saved);
    // 저장하면 지도(홈)로 돌아간다
    await refreshMine();
    router.push("/");
  }

  async function deleteAccount() {
    const { error } = await supabase.rpc("delete_my_account");
    if (error) {
      setMsg(t("계정을 삭제하지 못했습니다. 잠시 후 다시 시도하세요."));
      return;
    }
    await supabase.auth.signOut();
    await refreshMine();
    router.replace("/");
  }

  if (!profile || !draft) return <PanelLoading />;

  return (
    <Panel
      title={t("내 프로필")}
      titleSlot={
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[15px] font-semibold text-ink">{t("내 프로필")}</span>
          <LangSwitch className="ml-auto" />
        </span>
      }
    >
      <div className="px-5 pb-8 pt-4">
        {needsHandle && (
          <p className="rounded-lg bg-surface px-3 py-2 text-[14px] text-teal">
            {t("핸들을 정하면 내 지도의 주소가 됩니다: /@핸들. 나중에 언제든 바꿀 수 있습니다.")}
          </p>
        )}
        <form onSubmit={saveProfile} className="mt-4 grid gap-4">
          {/* 프로필 사진 옆에 핸들(화면을 짧게) */}
          <div className="flex items-start gap-4">
          <AvatarPicker userId={profile.id} name={draft.display_name || profile.handle} onChange={refreshMine} />
          <label className="grid min-w-0 flex-1 gap-1 text-[13px] font-semibold text-ink">
            {t("핸들")}
            <span className="flex min-w-0 items-center rounded-lg border border-rule bg-surface pl-3 text-[15px] font-normal text-muted focus-within:outline-2 focus-within:outline-teal">
              @
              <input
                value={draft.handle}
                onChange={(e) => setDraft({ ...draft, handle: e.target.value })}
                className="w-0 min-w-0 flex-1 rounded-r-lg bg-white px-2 py-2.5 text-ink outline-none"
                autoComplete="username"
              />
            </span>
            {!needsHandle && (
              <span className="text-[12px] font-normal text-muted">
                {t("핸들을 바꾸면 이전 주소로 공유한 링크는 열리지 않습니다.")}
              </span>
            )}
          </label>
          </div>
          <label className="grid gap-1 text-[13px] font-semibold text-ink">
            {t("이름")}
            <input
              value={draft.display_name}
              onChange={(e) => setDraft({ ...draft, display_name: e.target.value })}
              maxLength={40}
              className="field"
            />
          </label>
          <label className="grid gap-1 text-[13px] font-semibold text-ink">
            {t("소개")}
            <textarea
              value={draft.bio}
              onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
              rows={2}
              maxLength={200}
              className="field"
              placeholder={t("어떤 곳을 소개하는 사람인가요?")}
            />
          </label>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={!dirty && !needsHandle} className="btn-primary disabled:opacity-40">
              {t("저장하고 지도로")}
            </button>
            {msg && <span role="status" className="text-[14px] text-muted">{msg}</span>}
          </div>
        </form>

        <div className="mt-8">
          <PushToggle />
        </div>
        <div className="mt-6 grid gap-2 border-t border-rule pt-6">
          {!needsHandle && (
            <Link href={`/@${profile.handle}`} className="btn-quiet justify-center">
              {t("내 리스트 보기")}
            </Link>
          )}
          <Link href="/me/reservations" className="btn-quiet justify-center">{t("내 예약 문의")}</Link>
          <Link href="/biz" className="btn-quiet justify-center">{t("상업 이용자용 콘솔")}</Link>
          <Link href="/support" className="btn-quiet justify-center">{t("문의·신고하기")}</Link>
          {money?.is_admin && <Link href="/admin" className="btn-quiet justify-center">{t("운영자 콘솔")}</Link>}
          <SignOutButton className="btn-quiet justify-center" />
        </div>

        <div className="mt-10 border-t border-rule pt-6 text-[13px] text-muted">
          <p>
            PinWith v{APP_VERSION}
            {" · "}
            <Link href="/privacy" className="underline">{t("개인정보처리방침")}</Link>
            {" · "}
            <Link href="/terms" className="underline">{t("이용약관")}</Link>
            {" · "}
            <Link href="/for-businesses" className="underline">{t("가게 사장님께")}</Link>
            {" · "}
            <a href="mailto:support@pinwith.me" className="underline">support@pinwith.me</a>
          </p>
          <div className="mt-4">
            <ConfirmButton
              label={t("계정 삭제")}
              question={deleteQuestion(leftover, t, locale)}
              confirmLabel={t("삭제")}
              onConfirm={deleteAccount}
              className="font-semibold text-pin hover:underline"
            />
          </div>
          <p className="mt-1">{t("내 프로필, 리스트, 팔로우, 좋아요가 모두 지워지며 되돌릴 수 없습니다.")}</p>
        </div>
      </div>
    </Panel>
  );
}
