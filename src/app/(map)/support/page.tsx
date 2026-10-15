import type { Metadata } from "next";
import { SupportForm } from "@/components/SupportForm";

export const metadata: Metadata = { title: "문의·신고하기" };

export default function Page() {
  return <SupportForm />;
}
