"use client";
import { createClient } from "@/lib/supabase/client";

const ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const randomCode = (n = 6) =>
  Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => ALPHABET[b % ALPHABET.length]).join("");

// 공유용 짧은 링크(/s/코드). 내 리스트·내 지도만 만들 수 있고, 안 되면 원래 주소를 돌려준다.
export async function shortLink(target: { listId: string } | { profileId: string }, fallback: string) {
  try {
    const supabase = createClient();
    const { data } = await supabase.auth.getClaims();
    const me = data?.claims?.sub as string | undefined;
    if (!me) return fallback;
    const col = "listId" in target ? "target_list_id" : "target_profile_id";
    const id = "listId" in target ? target.listId : target.profileId;
    const { data: existing } = await supabase
      .from("short_links")
      .select("code")
      .eq("owner_id", me)
      .eq(col, id)
      .is("channel_label", null)
      .limit(1)
      .maybeSingle();
    let code = existing?.code as string | undefined;
    for (let tries = 0; !code && tries < 3; tries++) {
      const c = randomCode();
      const { error } = await supabase.from("short_links").insert({ code: c, owner_id: me, [col]: id });
      if (!error) code = c;
    }
    return code ? `${window.location.origin}/s/${code}` : fallback;
  } catch {
    return fallback;
  }
}

// 채널별 링크(예: 인스타 프로필, 유튜브 설명란). 같은 리스트라도 채널마다 다른 코드를 만들어 유입을 나눠 센다.
export async function createChannelLink(listId: string, label: string): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.auth.getClaims();
  const me = data?.claims?.sub as string | undefined;
  if (!me) return null;
  for (let tries = 0; tries < 3; tries++) {
    const c = randomCode();
    const { error } = await supabase
      .from("short_links")
      .insert({ code: c, owner_id: me, target_list_id: listId, channel_label: label.trim().slice(0, 40) });
    if (!error) return c;
  }
  return null;
}
