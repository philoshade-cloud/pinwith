"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// ── SNS 초안: 정기 작업이 인기 리스트를 골라 써 둔 X 글. 복사하거나 X 글쓰기 창으로 바로 열어 올리고 '올림'으로 표시 ──
type Draft = {
  id: string; created_at: string; post_on: string | null; list_path: string | null; body: string; alt_body: string | null;
  note: string | null; status: "draft" | "posted" | "skipped"; posted_at: string | null; post_url: string | null;
};
const SITE = "https://pinwith.me";
const STATUS: Record<Draft["status"], string> = { draft: "올릴 차례", posted: "올림", skipped: "건너뜀" };

// X가 세는 글자 수(대략): 링크는 23자, 한중일 글자는 2자
export function xLength(s: string) {
  const t = s.replace(/https?:\/\/\S+/g, "x".repeat(23));
  let n = 0;
  for (const ch of t) n += /[ᄀ-ᇿ⺀-鿿가-힯豈-﫿＀-￯]/.test(ch) ? 2 : 1;
  return n;
}

export function SocialPanel() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<Draft[] | null>(null);
  const [show, setShow] = useState<"draft" | "all">("draft");
  const [msg, setMsg] = useState("");
  const load = useCallback(async () => {
    let q = supabase.from("social_drafts").select("*").order("created_at", { ascending: false }).limit(40);
    if (show === "draft") q = q.eq("status", "draft");
    const { data, error } = await q;
    if (error) setMsg("불러오지 못했어요.");
    setRows((data as Draft[]) ?? []);
  }, [supabase, show]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function mark(id: string, status: Draft["status"], post_url?: string) {
    const { error } = await supabase
      .from("social_drafts")
      .update({ status, posted_at: status === "posted" ? new Date().toISOString() : null, post_url: post_url || null })
      .eq("id", id);
    setMsg(error ? "저장하지 못했어요." : "저장했어요.");
    load();
  }

  return (
    <section>
      <p className="text-[13px] text-muted">
        주 2회(월·목 아침) 정기 작업이 인기 리스트 하나를 골라 X 글 초안을 넣어 둬요. 링크를 글에 넣으면 X가 리스트의 지도 미리보기 그림을 카드로 붙여 줘요.
        &lsquo;X에서 쓰기&rsquo;를 누르면 글이 채워진 X 글쓰기 창이 열려요. 올린 뒤 &lsquo;올림&rsquo;을 눌러 두면 같은 리스트를 한동안 다시 고르지 않아요.
      </p>
      <div className="mt-3 flex gap-2">
        <button type="button" className={show === "draft" ? "btn-primary !py-1" : "btn-quiet !py-1"} onClick={() => setShow("draft")}>올릴 차례</button>
        <button type="button" className={show === "all" ? "btn-primary !py-1" : "btn-quiet !py-1"} onClick={() => setShow("all")}>전체</button>
      </div>
      {msg && <p className="mt-2 text-[13px] text-teal">{msg}</p>}
      {rows && rows.length === 0 && <p className="mt-6 text-[14px] text-muted">올릴 초안이 없어요.</p>}
      <ul className="mt-4 grid gap-4">
        {rows?.map((d) => <DraftCard key={d.id} d={d} onMark={mark} />)}
      </ul>
    </section>
  );
}

function DraftCard({ d, onMark }: { d: Draft; onMark: (id: string, s: Draft["status"], url?: string) => void }) {
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState("");
  const copy = async (text: string, which: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      /* 복사가 막힌 브라우저 */
    }
  };
  const versions = [
    { key: "a", label: "글", text: d.body },
    ...(d.alt_body ? [{ key: "b", label: "다른 버전", text: d.alt_body }] : []),
  ];
  return (
    <li className="rounded-xl border border-rule bg-white p-4">
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <span className={`rounded-full px-2 py-0.5 font-semibold ${d.status === "draft" ? "bg-pin text-white" : "bg-surface text-muted"}`}>{STATUS[d.status]}</span>
        <span className="text-muted">{d.post_on ?? d.created_at.slice(0, 10)} 올릴 글</span>
        {d.list_path && (
          <a href={SITE + d.list_path} target="_blank" rel="noreferrer" className="font-semibold text-teal underline">리스트 보기</a>
        )}
        {d.post_url && <a href={d.post_url} target="_blank" rel="noreferrer" className="text-teal underline">올린 글</a>}
      </div>
      {d.note && <p className="mt-2 text-[13px] text-ink/70">{d.note}</p>}
      {versions.map((v) => {
        const n = xLength(v.text);
        return (
          <div key={v.key} className="mt-3">
            <div className="flex items-center gap-2 text-[12px] text-muted">
              <span className="font-semibold text-ink">{v.label}</span>
              <span className={n > 280 ? "font-semibold text-pin" : ""}>{n}/280</span>
            </div>
            <pre className="mt-1 whitespace-pre-wrap rounded-lg bg-surface p-3 font-sans text-[14px] leading-relaxed text-ink">{v.text}</pre>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" className="btn-quiet !py-1" onClick={() => copy(v.text, v.key)}>{copied === v.key ? "복사됨" : "복사"}</button>
              <a className="btn-quiet !py-1" href={`https://x.com/intent/post?text=${encodeURIComponent(v.text)}`} target="_blank" rel="noreferrer">X에서 쓰기</a>
            </div>
          </div>
        );
      })}
      {d.status === "draft" ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-rule pt-3">
          <input className="field !w-64 !py-1 text-[13px]" placeholder="올린 글 주소(선택)" value={url} onChange={(e) => setUrl(e.target.value)} />
          <button type="button" className="btn-primary !py-1" onClick={() => onMark(d.id, "posted", url)}>올림</button>
          <button type="button" className="btn-quiet !py-1" onClick={() => onMark(d.id, "skipped")}>건너뜀</button>
        </div>
      ) : (
        <div className="mt-3">
          <button type="button" className="btn-quiet !py-1 text-[13px]" onClick={() => onMark(d.id, "draft")}>올릴 차례로 되돌리기</button>
        </div>
      )}
    </li>
  );
}
