import { renderPreview, OG_SIZE } from "@/components/og/PreviewImage";
import { getListPreview } from "@/lib/public";

export const alt = "PinWith 리스트";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ handle: string; slug: string }> }) {
  const { handle, slug } = await params;
  return renderPreview(await getListPreview(handle, slug), "list");
}
