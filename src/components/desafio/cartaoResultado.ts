"use client";

/**
 * Cartão do resultado para stories e status (1080×1920), desenhado no
 * próprio aparelho. Mostra só o placar e os nomes, nunca as respostas.
 */
export async function gerarCartaoResultado(d: { quem: string; sobre: string; acertos: number; total: number }): Promise<Blob | null> {
  await document.fonts?.ready;
  const c = document.createElement("canvas");
  c.width = 1080; c.height = 1920;
  const g = c.getContext("2d");
  if (!g) return null;
  const fundo = g.createLinearGradient(0, 0, 0, 1920);
  fundo.addColorStop(0, "#071430"); fundo.addColorStop(1, "#03060E");
  g.fillStyle = fundo; g.fillRect(0, 0, 1080, 1920);
  const brilho = g.createRadialGradient(540, 760, 40, 540, 760, 620);
  brilho.addColorStop(0, "rgba(76,141,255,.45)"); brilho.addColorStop(1, "rgba(76,141,255,0)");
  g.fillStyle = brilho; g.fillRect(0, 0, 1080, 1920);
  // constelação discreta
  for (let i = 0; i < 90; i++) {
    const x = (Math.sin(i * 12.9898) * 43758.5453 % 1 + 1) % 1 * 1080, y = (Math.sin(i * 78.233) * 12345.678 % 1 + 1) % 1 * 1920;
    g.fillStyle = i % 7 === 0 ? "rgba(255,168,52,.7)" : "rgba(127,178,255,.45)";
    g.beginPath(); g.arc(x, y, i % 7 === 0 ? 3 : 2, 0, 7); g.fill();
  }
  // marca
  g.strokeStyle = "#EAF0FA"; g.lineWidth = 6; g.beginPath(); g.arc(120, 150, 30, 0, 7); g.stroke();
  g.fillStyle = "#FFA834"; g.beginPath(); g.arc(120, 150, 10, 0, 7); g.fill();
  g.fillStyle = "#EAF0FA"; g.font = "800 60px Onest, sans-serif"; g.textBaseline = "middle"; g.fillText("orvok", 170, 152);
  // radar com os acertos
  const cx = 540, cy = 760;
  for (const r of [300, 210, 120]) { g.strokeStyle = "rgba(127,178,255,.25)"; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke(); }
  for (let k = 0; k < d.total; k++) {
    const a = (k / d.total) * Math.PI * 2 - Math.PI / 2, ok = k < d.acertos, r = ok ? 170 : 255;
    g.shadowColor = ok ? "#FFA834" : "transparent"; g.shadowBlur = ok ? 30 : 0;
    g.fillStyle = ok ? "#FFA834" : "#243252"; g.beginPath(); g.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, ok ? 26 : 20, 0, 7); g.fill();
  }
  g.shadowBlur = 0;
  g.fillStyle = "#FFA834"; g.beginPath(); g.arc(cx, cy, 70, 0, 7); g.fill();
  g.fillStyle = "#231400"; g.font = "800 76px Onest, sans-serif"; g.textAlign = "center"; g.fillText(d.sobre[0]!.toUpperCase(), cx, cy + 4);
  // placar
  g.fillStyle = "#EAF0FA"; g.font = "800 230px Onest, sans-serif"; g.fillText(`${d.acertos}`, cx - 70, 1250);
  g.fillStyle = "#8E9AB0"; g.font = "500 80px Onest, sans-serif"; g.textAlign = "left"; g.fillText(`de ${d.total}`, cx + 10, 1280);
  g.textAlign = "center"; g.fillStyle = "#EAF0FA"; g.font = "300 64px Onest, sans-serif";
  g.fillText(`${d.quem} acertou ${d.acertos} de ${d.total}`, cx, 1440);
  g.fillText(`sobre ${d.sobre}.`, cx, 1520);
  g.fillStyle = "#7FB2FF"; g.font = "500 44px Onest, sans-serif"; g.fillText("Quanto te conhecem? Descubra no orvok", cx, 1760);
  return await new Promise((ok) => c.toBlob((b) => ok(b), "image/png"));
}

/** Compartilha o cartão (stories, WhatsApp…) ou, se o aparelho não deixar, baixa a imagem. */
export async function compartilharCartao(blob: Blob, texto: string, url: string): Promise<"compartilhado" | "baixado"> {
  const arquivo = new File([blob], "orvok-resultado.png", { type: "image/png" });
  if (navigator.canShare?.({ files: [arquivo] })) {
    try { await navigator.share({ files: [arquivo], text: `${texto} ${url}` }); return "compartilhado"; } catch { /* cancelado */ }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = "orvok-resultado.png"; a.click();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return "baixado";
}
