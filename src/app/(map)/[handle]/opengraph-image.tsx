import { renderPreview, OG_SIZE } from "@/components/og/PreviewImage";
import { getCuratorPreview } from "@/lib/public";

export const alt = "PinWith 큐레이터 지도";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  return renderPreview(await getCuratorPreview(handle), "curator");
}
