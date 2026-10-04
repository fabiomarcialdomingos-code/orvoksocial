import { readFile } from "node:fs/promises";
import { join } from "node:path";

/** Fontes Onest (300, 500, 800) para as imagens geradas no servidor. */
let fontes: { name: string; data: Buffer; weight: 300 | 500 | 800; style: "normal" }[] | null = null;
export async function fontesCartao() {
  if (fontes) return fontes;
  const base = join(process.cwd(), "node_modules", "@fontsource", "onest", "files");
  const [leve, media, forte] = await Promise.all([300, 500, 800].map((p) => readFile(join(base, `onest-latin-${p}-normal.woff`))));
  fontes = [
    { name: "Onest", data: leve!, weight: 300, style: "normal" },
    { name: "Onest", data: media!, weight: 500, style: "normal" },
    { name: "Onest", data: forte!, weight: 800, style: "normal" },
  ];
  return fontes;
}

/** Prévia do link do convite (1200×630), a imagem que aparece no WhatsApp. */
export function CartaoConvite({ nome }: { nome: string | null }) {
  const titulo = nome ? `Como você vê ${nome}?` : "Como as pessoas te enxergam?";
  const sub = nome ? "Compartilhe a sua visão. É anônimo e leva cerca de 3 minutos." : "Descubra no orvok.";
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", background: "#040811", color: "#EAF0FA", fontFamily: "Onest", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", right: 120, top: 140, width: 340, height: 340, borderRadius: 340, border: "2px solid rgba(255,168,52,.5)", background: "radial-gradient(circle at 35% 30%, #0D2756, #040C1E)", boxShadow: "0 0 120px rgba(255,168,52,.35)", display: "flex" }} />
      <div style={{ position: "absolute", right: 250, top: 270, width: 84, height: 84, borderRadius: 84, background: "#FFA834", boxShadow: "0 0 60px #FFA834", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44, fontWeight: 800, color: "#231400" }}>{(nome ?? "o")[0]!.toUpperCase()}</div>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "64px 72px", width: 720 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 36, fontWeight: 800, letterSpacing: -1 }}>
          <div style={{ width: 34, height: 34, borderRadius: 34, border: "4px solid #EAF0FA", display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ width: 12, height: 12, borderRadius: 12, background: "#FFA834" }} /></div>
          orvok
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", fontSize: 24, fontWeight: 500, color: "#FFA834", letterSpacing: 4 }}>CONVITE</div>
          <div style={{ display: "flex", fontSize: 70, fontWeight: 300, lineHeight: 1.05, letterSpacing: -2 }}>{titulo}</div>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 500, color: "#8E9AB0" }}>{sub}</div>
        </div>
        <div style={{ display: "flex", alignSelf: "flex-start", padding: "16px 32px", borderRadius: 999, background: "#FFA834", color: "#231400", fontSize: 28, fontWeight: 800 }}>Responder</div>
      </div>
    </div>
  );
}
