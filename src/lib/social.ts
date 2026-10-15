"use client";
import { createClient } from "@/lib/supabase/client";

// 1:1 대화를 찾거나 만들고 대화 id를 돌려준다. 받는 사람이 나를 팔로우하지 않으면 '메시지 요청'이 된다.
export async function startDm(otherId: string): Promise<{ id: string } | { error: string }> {
  const { data, error } = await createClient().rpc("start_dm", { other: otherId });
  if (error) {
    return { error: error.message.includes("request limit") ? "오늘은 메시지 요청을 더 보낼 수 없습니다." : "대화를 시작하지 못했습니다." };
  }
  return { id: data as string };
}

export const TAGS = [
  { id: "missing_info", label: "정보 부족" },
  { id: "changed", label: "정보가 바뀜" },
  { id: "recommend", label: "추천 요청" },
  { id: "other", label: "기타" },
] as const;

export const ago = (iso: string) => {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "방금";
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  const d = Math.floor(s / 86400);
  return d < 7 ? `${d}일 전` : d < 30 ? `${Math.floor(d / 7)}주 전` : `${Math.floor(d / 30)}달 전`;
};
