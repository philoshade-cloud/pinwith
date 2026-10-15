"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Panel, PanelLoading } from "./shell/Panel";

const CATEGORIES = [
  { id: "question", label: "이용 문의" },
  { id: "bug", label: "오류·불편 신고" },
  { id: "report", label: "부적절한 내용 신고" },
  { id: "partnership", label: "제휴·광고 문의" },
  { id: "other", label: "기타" },
] as const;

// 고객센터: 문의와 신고를 운영자에게 보낸다
export function SupportForm() {
  // 주소의 ?type=…&list=… 를 읽으므로 Suspense 안에서 그린다.
  // (화면 안에서 이동해 오면 window.location은 아직 이전 주소라서 useSearchParams로 읽어야 한다)
  return (
    <Suspense fallback={<PanelLoading />}>
      <SupportFormFromUrl />
    </Suspense>
  );
}

function SupportFormFromUrl() {
  const q = useSearchParams();
  // 주소가 바뀌면(다른 리스트 신고) 처음부터 다시 그린다
  return <SupportFormInner key={q.toString()} type={q.get("type")} listId={q.get("list") ?? ""} from={q.get("from")} />;
}

function SupportFormInner({ type, listId, from: fromParam }: { type: string | null; listId: string; from: string | null }) {
  const supabase = useMemo(() => createClient(), []);
  const [category, setCategory] = useState<string>(type && CATEGORIES.some((c) => c.id === type) ? type : "question");
  const [email, setEmail] = useState("");
  const [body, setBody] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const from = fromParam ?? "";

  // 리스트 화면의 '이 리스트 신고'로 들어오면 어떤 리스트인지 함께 보낸다
  const [listTitle, setListTitle] = useState("");
  useEffect(() => {
    if (!listId) return;
    supabase.from("lists").select("title").eq("id", listId).maybeSingle().then(({ data }) => data && setListTitle(data.title as string));
  }, [supabase, listId]);

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
      body: JSON.stringify({ category, email, body, pageUrl: from, listId: listId || undefined }),
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
            {listTitle && (
              <p className="rounded-lg bg-surface px-3 py-2 text-[14px] text-ink">
                신고할 리스트: <b>{listTitle}</b>
                <span className="block text-[12px] text-muted">리스트 정보는 자동으로 함께 보내져요.</span>
              </p>
            )}
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
                placeholder={category === "report" ? (listTitle ? "신고하는 이유를 적어 주세요." : "신고할 리스트·댓글의 주소와 이유를 적어 주세요.") : "자세히 적어 주실수록 빨리 도와드릴 수 있어요."}
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
