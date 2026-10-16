"use client";

import { useLang } from "@/lib/i18n/client";

export function ByLang({ ko, en }: { ko: React.ReactNode; en: React.ReactNode }) {
  return useLang() === "en" ? en : ko;
}
