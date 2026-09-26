import { ImageResponse } from "next/og";
import { CARD_SIZES, cardFonts, getSharePreview, InviteCard } from "@/lib/share";

export const runtime = "nodejs";
export const size = CARD_SIZES.og;
export const contentType = "image/png";
export const alt = "Convite para o ORVOK";

export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const preview = (await getSharePreview(code)) ?? { active: false, displayName: "Alguém", theme: "noite" as const, message: null, teaser: null, teaserQuestionVersionId: null, teaserOptions: [] };
  const host = new URL(process.env.APP_URL ?? "https://orvok.com.br").host;
  return new ImageResponse(<InviteCard preview={preview} format="og" host={host} />, { ...size, fonts: await cardFonts() });
}
