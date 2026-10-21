"use client";

import { useState } from "react";
import { LANGS, type Lang } from "@/lib/i18n/core";
import { useExploreLangs } from "@/lib/exploreLangs";
import { useLang, useT } from "@/lib/i18n/client";

// My 화면: '타인의 핀'에서 볼 언어. 화면 언어와 따로 여러 개 고른다(검색 결과에는 적용하지 않음).
export function ExploreLangPicker() {
  const t = useT();
  const ui = useLang();
  const { langs, ready, save } = useExploreLangs();
  const [msg, setMsg] = useState("");

  async function toggle(id: Lang) {
    const next = langs.includes(id) ? langs.filter((x) => x !== id) : [...langs, id];
    if (next.length === 0) return setMsg(t("언어를 하나 이상 고르세요."));
    const ok = await save(next);
    setMsg(ok ? t("저장했어요.") : t("변경을 저장하지 못했습니다."));
  }

  return (
    <section id="explore-langs" className="scroll-mt-20 rounded-xl border border-rule p-4">
      <h2 className="text-[15px] font-semibold text-ink">{t("‘타인의 핀’에서 볼 언어")}</h2>
      <p className="mt-1 text-[13px] text-muted">
        {t("고른 언어로 만든 리스트만 ‘타인의 핀’ 목록에 보여요. 화면 언어와는 따로 정하고, 검색 결과에는 모든 언어가 나와요.")}
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5" aria-busy={!ready}>
        {[...LANGS].sort((a, b) => (a.id === ui ? -1 : b.id === ui ? 1 : 0)).map((l) => {
          const on = langs.includes(l.id);
          return (
            <button
              key={l.id}
              type="button"
              aria-pressed={on}
              disabled={!ready}
              onClick={() => toggle(l.id)}
              className={`rounded-full border px-3 py-1 text-[13px] font-semibold disabled:opacity-50 ${on ? "border-teal bg-teal text-white" : "border-rule bg-white text-ink/70"}`}
            >
              {on ? "✓ " : ""}{l.label}
            </button>
          );
        })}
      </div>
      {msg && <p role="status" className="mt-2 text-[12px] text-muted">{msg}</p>}
    </section>
  );
}
