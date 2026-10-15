"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";
import { Panel, PanelLoading } from "./shell/Panel";

const CATEGORIES = [
  { id: "question", label: "이용 문의" },
  { id: "bug", label: "오류·불편 신고" },
  { id: "report", label: "부적절한 내용 신고" },
  { id: "partnership", label: "제휴·광고 문의" },
  { id: "other", label: "기타" },
] as const;

const noop = () => () => {};

// 고객센터: 문의와 신고를 운영자에게 보낸다
export function SupportForm() {
  // 주소창 값(?type=…)을 쓰므로 브라우저에서만 그린다
  const ready = useSyncExternalStore(noop, () => true, () => false);
  return ready ? <SupportFormInner /> : <PanelLoading />;
}

function SupportFormInner() {
  const supabase = useMemo(() => createClient(), []);
  // 주소의 ?type=report&from=… 로 신고 대상과 종류를 미리 채운다(처음 한 번만 읽음)
  const [category, setCategory] = useState<string>(() =>
    typeof window === "undefined" ? "question" : new URLSearchParams(window.location.search).get("type") ?? "question",
  );
  const [email, setEmail] = useState("");
  const [body, setBody] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [from] = useState(() =>
    typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("from") ?? document.referrer,
  );

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => data.user?.email && setEmail((e) => e || data.user!.email!));
  }, [supabase]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || state === "sending") return;
    setState("sending");
    const res = await fetch("/api/support", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, email, body, pageUrl: from }),
    }).catch(() => null);
    setState(res?.ok ? "sent" : "error");
  }

  return (
    <Panel title="문의·신고하기">
      <div className="px-5 pb-10 pt-4">
        {state === "sent" ? (
          <div className="py-6">
            <p className="text-[16px] font-semibold text-ink">잘 받았습니다.</p>
            <p className="mt-2 text-[14px] text-muted">확인 후 적어 주신 메일로 답장드릴게요. 신고는 검토 후 조치합니다.</p>
            <button type="button" onClick={() => { setBody(""); setState("idle"); }} className="btn-quiet mt-4">다른 문의 보내기</button>
          </div>
        ) : (
          <form onSubmit={send} className="grid gap-4">
            <p className="text-[14px] text-ink/80">이용하면서 궁금한 점, 불편한 점, 오류, 부적절한 리스트·댓글 신고를 운영자에게 보내 주세요.</p>
            <label className="grid gap-1 text-[13px] font-semibold text-ink">
              종류
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="field">
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-[13px] font-semibold text-ink">
              답장 받을 메일 <span className="font-normal text-muted">(선택)</span>
              <input type="text" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} className="field" placeholder="you@example.com" autoComplete="email" />
            </label>
            <label className="grid gap-1 text-[13px] font-semibold text-ink">
              내용
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={6}
                maxLength={4000}
                required
                className="field"
                placeholder={category === "report" ? "신고할 리스트·댓글의 주소와 이유를 적어 주세요." : "자세히 적어 주실수록 빨리 도와드릴 수 있어요."}
              />
            </label>
            {state === "error" && <p role="alert" className="text-[14px] text-pin">보내지 못했습니다. 잠시 후 다시 시도하세요.</p>}
            <button type="submit" disabled={state === "sending" || !body.trim()} className="btn-primary justify-center !py-3 disabled:opacity-40">
              {state === "sending" ? "보내는 중" : "보내기"}
            </button>
          </form>
        )}
      </div>
    </Panel>
  );
}
