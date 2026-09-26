import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { authPool } from "./auth/session";

export type ShareTheme = "noite" | "aurora" | "mineral";
export type TeaserOption = { id: string; label: string; position: number };
export type SharePreview = {
  active: boolean; displayName: string; theme: ShareTheme; message: string | null;
  teaser: string | null; teaserQuestionVersionId: string | null; teaserOptions: TeaserOption[];
};

/** Public, session-less preview of a share link (owner name, theme, teaser). */
export async function getSharePreview(code: string): Promise<SharePreview | null> {
  if (!/^[A-Za-z0-9]{8,16}$/.test(code)) return null;
  const result = await authPool().query<SharePreview>(`SELECT * FROM orvok_share_link_preview($1)`, [code]);
  return result.rows[0] ?? null;
}

export type CatalogQuestion = { questionVersionId: string; text: string; options: TeaserOption[] };

/** Public, session-less read of the full published Radar catalog. Content
 *  only (no per-user data) — used so an invited visitor can guess every
 *  question about the inviter before creating an account. */
export async function getRadarCatalogPublic(): Promise<CatalogQuestion[]> {
  const result = await authPool().query<CatalogQuestion>(`SELECT * FROM orvok_radar_catalog_public()`);
  return result.rows;
}

export const THEMES: Record<ShareTheme, { bg: string; ink: string; soft: string; line: string; accent: string; accent2: string; name: string }> = {
  noite: { bg: "#0a1120", ink: "#e8edf3", soft: "#aab6c8", line: "rgba(150,172,212,0.22)", accent: "#6fd6c5", accent2: "#f4b89a", name: "Noite" },
  aurora: { bg: "#1a1230", ink: "#f6ecef", soft: "#c9b8c8", line: "rgba(244,184,154,0.25)", accent: "#f4b89a", accent2: "#a9b3ff", name: "Aurora" },
  mineral: { bg: "#eef0ec", ink: "#0f1a2c", soft: "#4d5b70", line: "rgba(15,26,44,0.14)", accent: "#138f7e", accent2: "#c9714a", name: "Mineral" },
};

let fonts: { name: string; data: Buffer; weight: 300 | 400 | 500; style: "normal" }[] | null = null;
export async function cardFonts() {
  if (fonts) return fonts;
  const base = join(process.cwd(), "node_modules", "@fontsource");
  const [light, regular, plex] = await Promise.all([
    readFile(join(base, "bricolage-grotesque/files/bricolage-grotesque-latin-300-normal.woff")),
    readFile(join(base, "bricolage-grotesque/files/bricolage-grotesque-latin-400-normal.woff")),
    readFile(join(base, "ibm-plex-sans/files/ibm-plex-sans-latin-500-normal.woff")),
  ]);
  fonts = [
    { name: "Bricolage", data: light, weight: 300, style: "normal" },
    { name: "Bricolage", data: regular, weight: 400, style: "normal" },
    { name: "Plex", data: plex, weight: 500, style: "normal" },
  ];
  return fonts;
}

export type CardFormat = "og" | "square" | "story";
export const CARD_SIZES: Record<CardFormat, { width: number; height: number }> = {
  og: { width: 1200, height: 630 },
  square: { width: 1080, height: 1080 },
  story: { width: 1080, height: 1920 },
};

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? name;
}

/** Radar rings drawn with nested bordered boxes (Satori supports flexbox, not SVG masks). */
function Rings({ size, theme }: { size: number; theme: (typeof THEMES)[ShareTheme] }) {
  const rings = [1, 0.74, 0.48, 0.22];
  const nodes = [
    { x: 0.8, y: 0.28, c: theme.accent, s: 16 },
    { x: 0.24, y: 0.34, c: theme.accent, s: 12 },
    { x: 0.66, y: 0.78, c: theme.accent2, s: 11 },
    { x: 0.14, y: 0.7, c: theme.accent, s: 8 },
    { x: 0.9, y: 0.6, c: theme.accent2, s: 7 },
  ];
  return (
    <div style={{ position: "relative", width: size, height: size, display: "flex" }}>
      {rings.map((r) => (
        <div key={r} style={{
          position: "absolute", left: (size * (1 - r)) / 2, top: (size * (1 - r)) / 2, width: size * r, height: size * r,
          borderRadius: size, border: `1.5px solid ${theme.line}`, display: "flex",
        }} />
      ))}
      <div style={{ position: "absolute", left: size / 2 - 1, top: 0, width: 1.5, height: size, background: theme.line, display: "flex" }} />
      <div style={{ position: "absolute", top: size / 2 - 1, left: 0, height: 1.5, width: size, background: theme.line, display: "flex" }} />
      {nodes.map((n, i) => (
        <div key={i} style={{ position: "absolute", left: n.x * size - n.s / 2, top: n.y * size - n.s / 2, width: n.s, height: n.s, borderRadius: n.s, background: n.c, display: "flex" }} />
      ))}
      <div style={{ position: "absolute", left: size / 2 - 60, top: size / 2 - 60, width: 120, height: 120, borderRadius: 120, background: theme.accent2, opacity: 0.18, display: "flex" }} />
      <div style={{ position: "absolute", left: size / 2 - 14, top: size / 2 - 14, width: 28, height: 28, borderRadius: 28, background: theme.accent2, display: "flex" }} />
    </div>
  );
}

export function InviteCard({ preview, format, host }: { preview: SharePreview; format: CardFormat; host: string }) {
  const theme = THEMES[preview.theme] ?? THEMES.noite;
  const { width, height } = CARD_SIZES[format];
  const name = firstName(preview.displayName);
  const vertical = format !== "og";
  const pad = format === "story" ? 96 : format === "square" ? 80 : 72;
  const ringSize = format === "story" ? 760 : format === "square" ? 520 : 470;
  const titleSize = format === "story" ? 118 : format === "square" ? 92 : 78;

  const brand = (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ display: "flex", position: "relative", width: 44, height: 30 }}>
        <div style={{ position: "absolute", left: 0, top: 0, width: 30, height: 30, borderRadius: 30, border: `2px solid ${theme.ink}`, display: "flex" }} />
        <div style={{ position: "absolute", left: 14, top: 0, width: 30, height: 30, borderRadius: 30, border: `2px solid ${theme.ink}`, opacity: 0.5, display: "flex" }} />
      </div>
      <div style={{ fontFamily: "Plex", fontSize: 24, letterSpacing: 6, color: theme.ink, display: "flex" }}>ORVOK</div>
    </div>
  );

  const copy = (
    <div style={{ display: "flex", flexDirection: "column", gap: vertical ? 36 : 26, maxWidth: vertical ? width - pad * 2 : 640 }}>
      <div style={{ fontFamily: "Plex", fontSize: vertical ? 34 : 26, color: theme.soft, display: "flex" }}>{preview.displayName} te convidou</div>
      <div style={{ fontFamily: "Bricolage", fontWeight: 300, fontSize: titleSize, lineHeight: 1.0, letterSpacing: -3, color: theme.ink, display: "flex" }}>
        Quanto você conhece {name}?
      </div>
      {preview.teaser && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, borderLeft: `3px solid ${theme.accent}`, paddingLeft: 24 }}>
          <div style={{ fontFamily: "Plex", fontSize: vertical ? 26 : 20, color: theme.accent, display: "flex" }}>Uma das perguntas</div>
          <div style={{ fontFamily: "Bricolage", fontWeight: 400, fontSize: vertical ? 44 : 32, lineHeight: 1.2, color: theme.ink, display: "flex" }}>{preview.teaser}</div>
        </div>
      )}
      {preview.message && !preview.teaser && (
        <div style={{ fontFamily: "Bricolage", fontSize: vertical ? 42 : 30, color: theme.ink, display: "flex" }}>{`“${preview.message}”`}</div>
      )}
    </div>
  );

  const cta = (
    <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
      <div style={{ display: "flex", padding: vertical ? "22px 40px" : "16px 30px", borderRadius: 999, background: theme.ink, color: theme.bg, fontFamily: "Plex", fontSize: vertical ? 32 : 24 }}>Aceitar o desafio</div>
      <div style={{ fontFamily: "Plex", fontSize: vertical ? 28 : 22, color: theme.soft, display: "flex" }}>{host}</div>
    </div>
  );

  return (
    <div style={{ width, height, display: "flex", flexDirection: vertical ? "column" : "row", background: theme.bg, padding: pad, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", display: "flex",
        right: vertical ? (width - ringSize) / 2 : -60, top: vertical ? (format === "story" ? 880 : 420) : (height - ringSize) / 2, opacity: 0.95 }}>
        <Rings size={ringSize} theme={theme} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: "100%", width: "100%" }}>
        {brand}
        {format === "story" ? <div style={{ display: "flex", flexDirection: "column", gap: 60, marginBottom: 880 }}>{copy}</div> : copy}
        {cta}
      </div>
    </div>
  );
}
