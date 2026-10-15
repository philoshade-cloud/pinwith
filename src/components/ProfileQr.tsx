"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

// 프로필 QR(3.5): 마주 앉은 사람이 카메라로 찍으면 바로 내 지도(팔로우 화면)가 열린다
export function ProfileQr({ url, name }: { url: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    QRCode.toDataURL(url, { width: 640, margin: 1, color: { dark: "#18222f", light: "#ffffff" } }).then(setSrc).catch(() => setSrc(null));
  }, [open, url]);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-quiet">QR</button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-6" onClick={() => setOpen(false)}>
          <div role="dialog" aria-label="프로필 QR" onClick={(e) => e.stopPropagation()} className="w-full max-w-[340px] rounded-2xl bg-white p-5 text-center">
            <p className="text-[16px] font-semibold text-ink">{name}</p>
            <p className="mt-1 text-[13px] text-muted">카메라로 찍으면 바로 열려요</p>
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt={`${name} 프로필 QR`} className="mx-auto mt-4 w-full max-w-[260px]" />
            ) : (
              <div className="mx-auto mt-4 aspect-square w-full max-w-[260px] rounded-lg bg-surface" />
            )}
            <p className="mt-3 break-all text-[12px] text-muted">{url}</p>
            <div className="mt-4 flex justify-center gap-2">
              {src && (
                <a href={src} download={`pinwith-${name}.png`} className="btn-quiet">이미지 저장</a>
              )}
              <button type="button" onClick={() => setOpen(false)} className="btn-primary">닫기</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
