import { ImageResponse } from "next/og";
import { CARD_SIZES, cardFonts, getSharePreview, InviteCard, type CardFormat } from "@/lib/share";

export const runtime = "nodejs";

/** PNG invite card for a share link: og (1200x630), square (1080) or story (1080x1920). */
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const format = (new URL(request.url).searchParams.get("format") ?? "og") as CardFormat;
  if (!(format in CARD_SIZES)) return new Response("formato inválido", { status: 400 });
  const preview = await getSharePreview(code);
  if (!preview) return new Response("convite não encontrado", { status: 404 });
  const host = new URL(process.env.APP_URL ?? request.url).host;
  const download = new URL(request.url).searchParams.get("download") === "1";
  const image = new ImageResponse(<InviteCard preview={preview} format={format} host={host} />, {
    ...CARD_SIZES[format],
    fonts: await cardFonts(),
    headers: {
      "Cache-Control": "public, max-age=300",
      ...(download ? { "Content-Disposition": `attachment; filename="convite-orvok-${format}.png"` } : {}),
    },
  });
  return image;
}
