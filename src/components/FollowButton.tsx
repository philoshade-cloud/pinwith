"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n/client";

// 팔로우/팔로우 취소. 로그인 전이면 로그인 화면으로 보낸 뒤 이 화면으로 돌아온다.
export function FollowButton({ curatorId, handle, className = "" }: { curatorId: string; handle: string; className?: string }) {
  const t = useT();
  const [me, setMe] = useState<string | null | undefined>(undefined);
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id ?? null;
      setMe(uid);
      if (!uid) return;
      const { data: row } = await supabase
        .from("follows")
        .select("follower_id")
        .eq("follower_id", uid)
        .eq("followee_id", curatorId)
        .maybeSingle();
      setFollowing(!!row);
    });
  }, [curatorId]);

  if (me === null) {
    return (
      <Link href={`/login?next=/@${handle}`} className={`btn-primary ${className}`}>
        {t("팔로우")}
      </Link>
    );
  }
  if (me === curatorId) return null;

  async function toggle() {
    if (!me || busy) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = following
      ? await supabase.from("follows").delete().eq("follower_id", me).eq("followee_id", curatorId)
      : await supabase.from("follows").insert({ follower_id: me, followee_id: curatorId });
    if (!error) setFollowing(!following);
    setBusy(false);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={me === undefined || busy}
      aria-pressed={following}
      className={`${following ? "btn-quiet" : "btn-primary"} disabled:opacity-60 ${className}`}
    >
      {following ? t("팔로잉") : t("팔로우")}
    </button>
  );
}
