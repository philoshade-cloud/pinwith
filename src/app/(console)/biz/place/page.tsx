import type { Metadata } from "next";
import { PlaceConsole } from "@/components/console/PlaceConsole";

export const metadata: Metadata = { title: "가게 콘솔", robots: { index: false } };

export default function Page() {
  return <PlaceConsole />;
}
