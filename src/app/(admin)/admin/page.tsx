import type { Metadata } from "next";
import { AdminConsole } from "@/components/AdminConsole";

export const metadata: Metadata = { title: "운영자 콘솔", robots: { index: false, follow: false } };

export default function Page() {
  return <AdminConsole />;
}
