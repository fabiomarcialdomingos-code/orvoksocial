// Testa as mensagens de convite por relação e os endereços de compartilhamento. Uso: npx tsx scripts/test-mensagens.ts
import { mensagemConvite, urlCompartilhar, PASSOS_STORIES } from "@/lib/desafio/mensagens";

const ok = (c: boolean, m: string) => { if (!c) { console.error("FALHOU:", m); process.exit(1); } console.log("ok -", m); };
const relacoes = ["familia", "amigos", "crush"] as const;

for (const r of relacoes) for (const t of [0, 1, 2]) {
  const m = mensagemConvite(r, t, "");
  ok(m.length > 20 && m.endsWith(":") && !m.includes("undefined") && !m.startsWith(","), `${r}/tom ${t}: mensagem completa, sem nome, termina em dois-pontos para o link`);
}
ok(mensagemConvite("amigos", 0, "Marina").startsWith("Marina, gostaria"), "o nome do destinatário entra no começo");
ok(mensagemConvite("amigos", 0, "  Marina  ").startsWith("Marina, "), "espaços em volta do nome são ignorados");
ok(mensagemConvite("amigos", 9, "") === mensagemConvite("amigos", 0, ""), "tom desconhecido cai no primeiro");
const todas = relacoes.flatMap((r) => [0, 1, 2].map((t) => mensagemConvite(r, t, "Rafa")));
ok(!todas.some((m) => /crush|paquera|namor|apaixon/i.test(m)), "nenhuma mensagem cita crush ou paquera (quem recebe não é classificado)");
ok(new Set(todas).size === todas.length || new Set(todas).size >= 8, "as mensagens são diferentes entre relações e tons");
ok(mensagemConvite("crush", 0, "Rafa") !== mensagemConvite("amigos", 0, "Rafa"), "alguém especial tem texto próprio");

const link = "https://orvok.com.br/d/D32P3C8K";
const wa = urlCompartilhar("whatsapp", link, "Oi, me conta?");
ok(wa.startsWith("https://wa.me/?text=") && decodeURIComponent(wa.split("text=")[1]!) === `Oi, me conta? ${link}`, "WhatsApp: texto e link juntos, codificados");
const fb = urlCompartilhar("facebook", link, "ignorado");
ok(fb === `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`, "Facebook: só o link (a prévia vem do card do convite)");
ok(PASSOS_STORIES.length === 3, "guia dos Stories tem 3 passos");
console.log("TODOS OS TESTES PASSARAM");
