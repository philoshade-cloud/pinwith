"use client";

import { useEffect, useState } from "react";
import { shortLink } from "@/lib/share";
import { useShell } from "./shell/context";
import { useT } from "@/lib/i18n/client";

// 공유 버튼(리스트 하나 또는 내 지도 전체). 짧은 링크를 미리 만들어 둔다:
// 휴대폰 공유 창은 누른 즉시 열어야 해서(기다렸다 열면 브라우저가 막는다).
export function ShareButton({
  target, title, path, className = "btn-quiet", label,
}: {
  target: { listId: string } | { profileId: string };
  title: string;
  // 짧은 링크를 못 만들 때 쓸 주소(예: /@handle/slug)
  path: string;
  className?: string;
  label?: string;
}) {
  const t = useT();
  const { toast } = useShell();
  const key = "listId" in target ? `l:${target.listId}` : `p:${target.profileId}`;
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    shortLink("listId" in target ? { listId: target.listId } : { profileId: target.profileId }, "").then((u) => alive && u && setUrl(u));
    return () => {
      alive = false;
    };
    // target 객체가 매번 새로 만들어져도 같은 대상이면 다시 만들지 않는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  async function share() {
    const link = url ?? `${window.location.origin}${path}`;
    try {
      if (navigator.share) await navigator.share({ title, url: link });
      else {
        await navigator.clipboard.writeText(link);
        toast(t("링크를 복사했습니다."));
      }
    } catch {
      /* 사용자가 공유를 취소함 */
    }
  }

  return (
    <button type="button" onClick={share} className={className}>
      {label ?? t("공유")}
    </button>
  );
}
