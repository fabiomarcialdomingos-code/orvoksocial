import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Fontes Onest (300, 500, 800) para as imagens geradas no servidor. Os arquivos ficam
 * no próprio repositório (src/lib/desafio/fonts), com nomes escritos por extenso para o
 * empacotamento da Vercel enxergar cada um (e next.config.ts reforça o empacotamento).
 * Não dependem de nenhum pacote em node_modules.
 */
let fontes: { name: string; data: Buffer; weight: 300 | 500 | 800; style: "normal" }[] | null = null;
export async function fontesCartao() {
  if (fontes) return fontes;
  const [leve, media, forte] = await Promise.all([
    readFile(join(process.cwd(), "src/lib/desafio/fonts/onest-latin-300-normal.woff")),
    readFile(join(process.cwd(), "src/lib/desafio/fonts/onest-latin-500-normal.woff")),
    readFile(join(process.cwd(), "src/lib/desafio/fonts/onest-latin-800-normal.woff")),
  ]);
  fontes = [
    { name: "Onest", data: leve, weight: 300, style: "normal" },
    { name: "Onest", data: media, weight: 500, style: "normal" },
    { name: "Onest", data: forte, weight: 800, style: "normal" },
  ];
  return fontes;
}

export type FormatoCartao = "preview" | "stories";
export const TAMANHO_CARTAO = { preview: { width: 1200, height: 630 }, stories: { width: 1080, height: 1920 } } as const;

const RELACAO: Record<string, { acento: string; rotulo: string }> = {
  familia: { acento: "#FFA834", rotulo: "FAMÍLIA" },
  amigos: { acento: "#7FB2FF", rotulo: "AMIGOS" },
  crush: { acento: "#FF8FB1", rotulo: "ALGUÉM ESPECIAL" },
};
const TINTA = "#EAF0FA", SUAVE = "#8F9DB5", ESCURO = "#1A1005";

/** Tamanho da letra do nome: encolhe para os nomes longos (até 24 letras) caberem em uma linha. */
const tamanhoDoNome = (nome: string, maximo: number, largura: number) => Math.max(40, Math.min(maximo, Math.floor(largura / (0.6 * (nome.length + 1)))));

function Orbe({ letra, acento, raio }: { letra: string; acento: string; raio: number }) {
  const d = raio * 2, miolo = Math.round(raio * 0.54);
  return (
    <div style={{ display: "flex", position: "relative", width: d, height: d, borderRadius: d, border: "3px solid rgba(120,95,50,1)", alignItems: "center", justifyContent: "center",
      backgroundImage: "radial-gradient(circle at 30% 25%, #0D2B66, #08142E)", boxShadow: "0 0 90px rgba(255,168,52,0.22), 0 0 130px rgba(60,110,255,0.20)" }}>
      {[{ x: 0.74, y: 0.22, t: 16 }, { x: 0.2, y: 0.4, t: 11 }, { x: 0.3, y: 0.78, t: 13 }].map((p, i) => (
        <div key={i} style={{ display: "flex", position: "absolute", left: d * p.x, top: d * p.y, width: p.t, height: p.t, borderRadius: p.t, background: "#96BEFF", boxShadow: "0 0 18px rgba(127,178,255,0.9)" }} />
      ))}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: miolo, height: miolo, borderRadius: miolo, background: acento, boxShadow: `0 0 50px ${acento}88`, color: ESCURO, fontSize: Math.round(miolo * 0.56), fontWeight: 800 }}>{letra}</div>
    </div>
  );
}

function Logo({ tamanho }: { tamanho: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: tamanho, height: tamanho, borderRadius: tamanho, border: `${Math.max(3, Math.round(tamanho / 9))}px solid ${TINTA}` }}>
        <div style={{ display: "flex", width: Math.round(tamanho * 0.4), height: Math.round(tamanho * 0.4), borderRadius: tamanho, background: "#FFA834" }} />
      </div>
      <div style={{ display: "flex", marginLeft: Math.round(tamanho * 0.3), fontSize: Math.round(tamanho * 1.05), fontWeight: 800, color: TINTA }}>orvok</div>
    </div>
  );
}

function Etiqueta({ acento, texto, tamanho }: { acento: string; texto: string; tamanho: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", padding: `${Math.round(tamanho * 0.5)}px ${Math.round(tamanho * 1.1)}px`, borderRadius: 999, border: `1px solid ${acento}88`, background: "rgba(255,255,255,0.04)", color: acento, fontSize: tamanho, fontWeight: 500, letterSpacing: Math.round(tamanho * 0.12) }}>{texto}</div>
  );
}

/**
 * O card do convite, em cartão de visita: a prévia do link no WhatsApp (1200×630) e o cartão vertical para Stories
 * (1080×1920). Só o nome de quem convidou e a relação; nunca respostas.
 */
export function CartaoConvite({ nome, relacao, formato = "preview" }: { nome: string | null; relacao?: string | null; formato?: FormatoCartao }) {
  const rel = (relacao && RELACAO[relacao]) || RELACAO.familia!;
  const acento = relacao && RELACAO[relacao] ? rel.acento : "#FFA834";
  const letra = nome ? nome.trim().charAt(0).toUpperCase() : "?";
  const fundo = "radial-gradient(circle at 88% 8%, rgba(40,90,230,0.26), transparent 42%), radial-gradient(circle at 6% 96%, rgba(255,150,40,0.17), transparent 40%)";
  const sub = nome ? `${nome} escolheu você para contar como te enxerga. É anônimo.` : "Descubra como as pessoas que importam te enxergam.";
  const fichas = ["12 perguntas", "3 minutos", "anônimo"];

  if (formato === "stories") {
    const t = nome ? tamanhoDoNome(nome, 120, 900) : 120;
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", height: "100%", background: "#040811", backgroundImage: fundo, color: TINTA, fontFamily: "Onest", padding: "86px 60px", position: "relative" }}>
        <div style={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center" }}>
          <Logo tamanho={46} />
          <Etiqueta acento={acento} texto={nome ? "CONVITE PESSOAL" : "CONVITE"} tamanho={24} />
        </div>
        <div style={{ display: "flex", marginTop: 150 }}><Orbe letra={letra} acento={acento} raio={250} /></div>
        <div style={{ display: "flex", marginTop: 110, fontSize: 92, fontWeight: 300 }}>{nome ? "Como você vê" : "Como as pessoas"}</div>
        <div style={{ display: "flex", marginTop: 6, fontSize: nome ? t : 120, fontWeight: 800 }}>{nome ? `${nome}?` : "te enxergam?"}</div>
        <div style={{ display: "flex", marginTop: 34, width: 820, textAlign: "center", justifyContent: "center", fontSize: 40, fontWeight: 300, color: SUAVE, lineHeight: 1.35 }}>{sub}</div>
        <div style={{ display: "flex", marginTop: 56 }}>
          {fichas.map((f) => (<div key={f} style={{ display: "flex", margin: "0 9px", padding: "12px 22px", borderRadius: 999, border: "2px solid rgba(70,84,120,1)", fontSize: 30, fontWeight: 500 }}>{f}</div>))}
        </div>
        <div style={{ display: "flex", flexGrow: 1 }} />
        <div style={{ display: "flex", fontSize: 34, fontWeight: 500, color: SUAVE }}>orvok.com.br</div>
        <div style={{ display: "flex", marginTop: 26, padding: "14px 70px", borderRadius: 999, border: `2px solid ${acento}99`, fontSize: 28, fontWeight: 500, color: acento }}>toque no link aqui</div>
      </div>
    );
  }

  const t = nome ? tamanhoDoNome(nome, 92, 690) : 84;
  return (
    <div style={{ display: "flex", width: "100%", height: "100%", background: "#040811", backgroundImage: fundo, color: TINTA, fontFamily: "Onest", position: "relative" }}>
      <div style={{ display: "flex", position: "absolute", left: 44, top: 44, width: 1112, height: 542, borderRadius: 34, background: "#0A1224", border: "2px solid rgba(110,86,48,1)" }} />
      <div style={{ display: "flex", position: "absolute", left: 58, top: 58, width: 1084, height: 514, borderRadius: 24, border: "1px solid rgba(26,38,66,1)" }} />
      <div style={{ display: "flex", position: "absolute", left: 84, top: 82 }}><Logo tamanho={34} /></div>
      <div style={{ display: "flex", position: "absolute", right: 88, top: 78 }}><Etiqueta acento={acento} texto={nome ? "CONVITE PESSOAL" : "CONVITE"} tamanho={19} /></div>
      <div style={{ display: "flex", flexDirection: "column", position: "absolute", left: 86, top: 180, width: 700 }}>
        <div style={{ display: "flex", fontSize: nome ? 80 : 76, fontWeight: 300, lineHeight: 1.05 }}>{nome ? "Como você vê" : "Como as pessoas"}</div>
        <div style={{ display: "flex", fontSize: nome ? t : 84, fontWeight: 800, lineHeight: 1.1, marginTop: 4 }}>{nome ? `${nome}?` : "te enxergam?"}</div>
        <div style={{ display: "flex", marginTop: 22, width: 640, fontSize: 29, fontWeight: 300, color: SUAVE, lineHeight: 1.3 }}>{sub}</div>
      </div>
      <div style={{ display: "flex", position: "absolute", left: 86, top: 498, alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 286, height: 58, borderRadius: 29, background: acento, color: ESCURO, fontSize: 25, fontWeight: 800 }}>Responder agora</div>
        <div style={{ display: "flex", marginLeft: 30, fontSize: 21, fontWeight: 500, color: SUAVE }}>{fichas.join("  ·  ")}</div>
      </div>
      <div style={{ display: "flex", position: "absolute", left: 790, top: 160 }}><Orbe letra={letra} acento={acento} raio={150} /></div>
    </div>
  );
}
