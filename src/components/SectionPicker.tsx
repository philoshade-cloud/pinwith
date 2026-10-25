"use client";

import { createClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n/client";

// 장소를 저장할 때 고르는 섹션: 있는 섹션, '섹션 없음', '+ 새 섹션 만들기'(이름 칸이 열림)
export const NEW_SECTION = "__newsec__";

export function SectionPicker({
  sections, value, onChange, newName, onNewName,
}: {
  sections: { id: string; name: string }[];
  value: string;
  onChange: (v: string) => void;
  newName: string;
  onNewName: (v: string) => void;
}) {
  const t = useT();
  return (
    <div className="grid gap-1.5">
      <label className="grid gap-1 text-[13px] font-semibold text-ink">
        {t("섹션")}
        <select value={value} onChange={(e) => onChange(e.target.value)} className="field">
          <option value="">{t("섹션 없음")}</option>
          {sections.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
          <option value={NEW_SECTION}>{t("+ 새 섹션 만들기")}</option>
        </select>
      </label>
      {value === NEW_SECTION && (
        <input
          value={newName}
          onChange={(e) => onNewName(e.target.value)}
          maxLength={60}
          autoFocus
          aria-label={t("새 섹션 이름")}
          placeholder={t("새 섹션 이름 (예: Day 1, 카페)")}
          className="field"
        />
      )}
    </div>
  );
}

// 저장하기 직전에 고른 값을 실제 섹션 id로 바꾼다. 새 섹션이면 리스트 맨 뒤에 만든다(같은 이름이 있으면 그걸 쓴다).
export async function resolveSection(
  listId: string,
  value: string,
  newName: string,
  known: { id: string; name: string }[],
): Promise<string | null> {
  if (value !== NEW_SECTION) return known.some((s) => s.id === value) ? value : null;
  const name = newName.trim();
  if (!name) return null;
  const supabase = createClient();
  const { data: existing } = await supabase.from("sections").select("id, name, position").eq("list_id", listId);
  const same = existing?.find((s) => s.name.trim() === name);
  if (same) return same.id;
  const position = (existing ?? []).reduce((m, s) => Math.max(m, s.position + 1), 0);
  const { data, error } = await supabase.from("sections").insert({ list_id: listId, name, position }).select("id").single();
  if (error || !data) throw new Error("section");
  return data.id as string;
}
