"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useExampleLists } from "@/lib/examples";

// '예시' 탭: 지금 언어의 첫 번째 예시 리스트로 보낸다. 예시를 못 불러오면 내장 샘플(fallback)을 보여 준다.
export function DemoRedirect({ fallback }: { fallback: React.ReactNode }) {
  const router = useRouter();
  const examples = useExampleLists();
  const first = examples?.[0];
  useEffect(() => {
    if (first) router.replace(first.href);
  }, [first, router]);
  return examples && examples.length === 0 ? <>{fallback}</> : null;
}
