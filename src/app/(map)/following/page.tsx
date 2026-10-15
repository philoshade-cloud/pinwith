import type { Metadata } from "next";
import { FollowingView } from "@/components/FollowingView";

export const metadata: Metadata = { title: "팔로잉 리스트" };

export default function Page() {
  return <FollowingView />;
}
