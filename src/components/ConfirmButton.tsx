"use client";

import { useState } from "react";

// 브라우저 확인 창(confirm/prompt) 대신 화면 안에서 묻는다. 일부 휴대폰·인앱 브라우저는 확인 창을 띄우지 않아
// 버튼이 아무 반응 없는 것처럼 보이기 때문이다.
export function ConfirmButton({
  label, question, confirmLabel = "확인", onConfirm, className = "btn-quiet !px-3 !py-1 !text-[12px]", withNote, noteDefault = "", noteRequired,
}: {
  label: React.ReactNode;
  question: string;
  confirmLabel?: string;
  onConfirm: (note: string) => void | Promise<void>;
  className?: string;
  // 메모 칸(예: 손님에게 보낼 말)을 함께 받을 때 그 안내 문구
  withNote?: string;
  // 메모 칸에 미리 채워 둘 값
  noteDefault?: string;
  // 메모를 비우면 확인 버튼을 누를 수 없게
  noteRequired?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  if (!open)
    return (
      <button
        type="button"
        onClick={() => {
          setNote(noteDefault);
          setOpen(true);
        }}
        className={className}
      >
        {label}
      </button>
    );
  return (
    <span role="group" aria-label={question} className="flex w-full flex-col gap-2 rounded-lg border border-pin/40 bg-[#fff7fb] p-3 text-left text-[13px] font-normal text-ink">
      <span className="whitespace-pre-wrap">{question}</span>
      {withNote && (
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={300}
          placeholder={withNote}
          aria-label={withNote}
          autoFocus
          className="field !py-1.5 !text-[14px]"
        />
      )}
      <span className="flex gap-2">
        <button
          type="button"
          disabled={busy || (noteRequired && !note.trim())}
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm(note);
            } finally {
              setBusy(false);
              setOpen(false);
              setNote("");
            }
          }}
          className="btn-primary !px-3 !py-1 !text-[13px] disabled:opacity-50"
        >
          {busy ? "처리 중" : confirmLabel}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn-quiet !px-3 !py-1 !text-[13px]">취소</button>
      </span>
    </span>
  );
}
