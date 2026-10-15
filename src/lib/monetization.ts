"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// 내 수익화 상태: 자격(팔로워 또는 최근 30일 광고 노출이 기준 이상, 또는 운영자가 분배율을 정함),
// 이미 수익화 중인 리스트가 있는지, 운영자인지.
export type Monetization = {
  eligible: boolean;
  followers: number;
  views_30d: number;
  min_followers: number;
  min_ad_views_30d: number;
  monetizing: boolean;
  rate_pct: number;
  is_admin: boolean;
};

export function useMonetization(enabled = true) {
  const [m, setM] = useState<Monetization | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    createClient()
      .rpc("my_monetization")
      .then(({ data }) => alive && data && setM(data as Monetization));
    return () => {
      alive = false;
    };
  }, [enabled]);
  return m;
}

export const won = (n: number) => n.toLocaleString("ko-KR");
