"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "./ListExplorer";
import { useT } from "@/lib/i18n/client";

const SIZE = 320;
const BUCKET = "avatars";

// 사진을 가운데 기준 정사각형으로 잘라 320px webp로 줄인다(올리는 용량을 작게)
async function squareWebp(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  canvas.getContext("2d")!.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  bmp.close();
  return new Promise((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error("encode"))), "image/webp", 0.85));
}

// 우리 저장소에 올린 사진이면 파일 경로(<user id>/<이름>.webp)를 돌려준다
function ownPath(url: string | null) {
  const m = url?.match(/\/storage\/v1\/object\/public\/avatars\/(.+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}

// 프로필 사진: 사진을 누르면 올리기(없을 때) 또는 바꾸기·지우기 메뉴. 펜 표시로 고칠 수 있음을 알린다.
export function AvatarPicker({ userId, name, onChange }: { userId: string; name: string; onChange?: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const input = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [menu, setMenu] = useState(false);
  const t = useT();

  useEffect(() => {
    supabase.from("profiles").select("avatar_url").eq("id", userId).maybeSingle().then(({ data }) => setUrl((data?.avatar_url as string) ?? null));
  }, [supabase, userId]);

  async function save(next: string | null) {
    const prev = ownPath(url);
    const { error } = await supabase.from("profiles").update({ avatar_url: next }).eq("id", userId);
    if (error) throw error;
    if (prev) await supabase.storage.from(BUCKET).remove([prev]);
    setUrl(next);
    onChange?.();
  }

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setMsg("");
    try {
      const blob = await squareWebp(file);
      const path = `${userId}/${Date.now()}.webp`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: "image/webp", cacheControl: "31536000" });
      if (error) throw error;
      await save(supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl);
      setMsg(t("사진을 바꿨어요."));
    } catch {
      setMsg(t("사진을 올리지 못했어요. 다른 사진으로 해 보세요."));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function clear() {
    setBusy(true);
    try {
      await save(null);
      setMsg(t("사진을 지웠어요."));
    } catch {
      setMsg(t("지우지 못했어요."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative shrink-0">
      {/* 사진을 누르면 올리기·바꾸기·지우기 */}
      <button
        type="button"
        onClick={() => (url ? setMenu(!menu) : input.current?.click())}
        disabled={busy}
        aria-label={url ? t("프로필 사진 바꾸기") : t("프로필 사진 올리기")}
        aria-expanded={url ? menu : undefined}
        className="relative block rounded-full disabled:opacity-50"
      >
        <Avatar name={name || "?"} url={url} size={64} />
        <span aria-hidden className="absolute -bottom-0.5 -right-0.5 grid h-6 w-6 place-items-center rounded-full border-2 border-white bg-ink text-white">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M3 17.25V21h3.75L17.8 9.95l-3.75-3.75L3 17.25zm17.7-10.2a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" /></svg>
        </span>
      </button>
      {menu && (
        <span className="absolute left-0 top-[72px] z-10 grid w-40 overflow-hidden rounded-xl border border-rule bg-white text-[14px] shadow-lg">
          <button type="button" onClick={() => { setMenu(false); input.current?.click(); }} className="px-3 py-2.5 text-left hover:bg-surface">{t("사진 바꾸기")}</button>
          <button type="button" onClick={() => { setMenu(false); clear(); }} className="px-3 py-2.5 text-left text-pin hover:bg-surface">{t("사진 지우기")}</button>
          <button type="button" onClick={() => setMenu(false)} className="px-3 py-2.5 text-left text-muted hover:bg-surface">{t("취소")}</button>
        </span>
      )}
      {(busy || msg) && (
        <span role="status" className="absolute left-0 top-[70px] w-max max-w-[200px] text-[11px] text-muted">{busy ? t("올리는 중") : msg}</span>
      )}
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
    </div>
  );
}
