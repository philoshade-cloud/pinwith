"use client";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n/client";

// Apple·Facebook 로그인 버튼. 운영자 콘솔(서비스 사용량 → 로그인 방식)에서 켠 것만 보인다.
// Supabase → Authentication → Providers에 각 회사 설정을 마친 뒤 켤 것.
type Provider = "apple" | "facebook";
const ORDER: Provider[] = ["apple", "facebook"];

export function SocialLogins({ redirectTo }: { redirectTo: () => string }) {
  const t = useT();
  const supabase = useMemo(() => createClient(), []);
  const [on, setOn] = useState<Record<Provider, boolean> | null>(null);
  const [busy, setBusy] = useState<Provider | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    supabase
      .from("app_flags")
      .select("value")
      .eq("key", "login")
      .maybeSingle()
      .then(({ data }) => setOn((data?.value as Record<Provider, boolean>) ?? { apple: false, facebook: false }));
  }, [supabase]);

  async function go(p: Provider) {
    setBusy(p);
    setErr(false);
    const { error } = await supabase.auth.signInWithOAuth({ provider: p, options: { redirectTo: redirectTo() } });
    if (error) {
      setBusy(null);
      setErr(true);
    }
  }

  const list = ORDER.filter((p) => on?.[p]);
  if (!list.length) return null;
  const style: Record<Provider, string> = {
    apple: "bg-black text-white hover:bg-black/85",
    facebook: "bg-[#1877F2] text-white hover:brightness-95",
  };
  const label: Record<Provider, string> = {
    apple: t("Apple로 계속하기"),
    facebook: t("Facebook으로 계속하기"),
  };
  return (
    <div className="mt-3 grid gap-2">
      {list.map((p) => (
        <button
          key={p}
          type="button"
          disabled={!!busy}
          onClick={() => go(p)}
          className={`w-full rounded-full px-4 py-3 text-[15px] font-semibold disabled:opacity-60 ${style[p]}`}
        >
          {busy === p ? t("이동하는 중…") : label[p]}
        </button>
      ))}
      {err && <p role="alert" className="text-[14px] text-pin">{t("로그인 화면을 열지 못했어요. 잠시 뒤 다시 시도하세요.")}</p>}
    </div>
  );
}
