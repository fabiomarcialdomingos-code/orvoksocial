// Testa o desafio sem cadastro contra um banco migrado.
// Uso: AUTH_SECRET=... AUTH_DATABASE_URL=(papel orvok_auth_runtime) DATABASE_URL=(dono) pnpm test:desafio
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { DesafioService } from "@/lib/desafio/service";
import { AVISO_HASH, AVISO_VERSAO } from "@/lib/desafio/catalogo";
import { BANCO } from "@/lib/desafio/banco";
import { escolherAncoras, escolherRestantes, perfilDasAncoras, perguntaPorChave } from "@/lib/desafio/selecao";

const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
const adm = new Pool({ connectionString: process.env.DATABASE_URL });
const svc = new DesafioService(pool);
const ok = (c: boolean, m: string) => { if (!c) { console.error("FALHOU:", m); process.exit(1); } console.log("ok -", m); };
const respostas = ["B","A","B","D","B","A","D","D","C","C"];

// Banco e seleção
ok(BANCO.length === 145 && new Set(BANCO.map((p) => p.chave)).size === 145 && BANCO.filter((p) => !p.contexto).length === 100, "banco: 100 gerais + 45 por relação, todas únicas");
const relacoes = ["familia", "amigos", "crush"] as const;
let especificas = 0;
for (let rodada = 0; rodada < 300; rodada++) {
  const rel = relacoes[rodada % 3]!;
  const anc = escolherAncoras();
  const eixos = new Set(anc.map((p) => p.ancora?.eixo)), temasAnc = new Set(anc.map((p) => p.tema));
  if (anc.length !== 3 || eixos.size !== 3 || temasAnc.size !== 3) ok(false, "âncoras: 3 eixos e 3 temas diferentes");
  const resp = anc.map((p) => ({ chave: p.chave, opcao: Math.floor(Math.random() * 4) }));
  const resto = escolherRestantes(anc.map((p) => p.chave), perfilDasAncoras(resp), new Map(), rel);
  if (resto.some((p) => p.contexto && p.contexto !== rel)) ok(false, "nunca entra pergunta de outra relação");
  especificas += resto.filter((p) => p.contexto === rel).length;
  const todas = [...anc, ...resto];
  if (todas.length !== 10 || new Set(todas.map((p) => p.tema)).size !== 10 || new Set(todas.map((p) => p.chave)).size !== 10) ok(false, "10 perguntas, uma por tema");
  if (!resto[resto.length - 1]?.d) ok(false, "termina com uma divertida");
  for (let n = 1; n < resto.length - 1; n++) if (resto[n]!.nivel < resto[n - 1]!.nivel) ok(false, "vai do leve ao profundo");
}
ok(true, "300 sorteios: 3 âncoras de eixos e temas diferentes, 10 temas sem repetir, do leve ao profundo, fecha com divertida, sem perguntas de outra relação");
ok(especificas / 300 >= 3, `perguntas da relação escolhida aparecem bastante (média ${(especificas / 300).toFixed(1)} de 7)`);
const perfilP = perfilDasAncoras([{ chave: "dec-plano", opcao: 0 }]);
ok(perfilP.ritmo === "P", "âncora revela o perfil (planejado)");
let comBonus = 0;
for (let n = 0; n < 200; n++) comBonus += escolherRestantes(["dec-plano", "tl-festa", "emo-filme"], perfilP, new Map(), "amigos").filter((p) => p.para === "P").length;
ok(comBonus / 200 >= 1, `perfil puxa perguntas que dividem planejados (média ${(comBonus / 200).toFixed(1)} por desafio)`);
const exemplo = [...escolherAncoras()];
const conjunto = [...exemplo, ...escolherRestantes(exemplo.map((p) => p.chave), {}, new Map(), "familia")].map((p) => p.chave);
ok(perguntaPorChave(conjunto[0]!) !== undefined, "conjunto de exemplo montado");
const consent = { aceito: true, versao: AVISO_VERSAO, hash: AVISO_HASH };

const { codigo, token: dono } = await svc.criar({ nome: "  Caio  ", relacao: "familia", perguntas: conjunto, respostas, consentimento: consent }, null);
ok(/^[A-HJ-NP-Z2-9]{8}$/.test(codigo) && dono.length === 43, `desafio criado (${codigo})`);
try { await svc.criar({ nome: "Caio", relacao: "familia", perguntas: conjunto, respostas, consentimento: { ...consent, hash: "0".repeat(64) } }, dono); ok(false, "hash inválido deveria falhar"); } catch { ok(true, "consentimento com hash errado é recusado"); }
const v = await svc.vitrine(codigo, null);
ok(v.nome === "Caio" && v.perguntas.length === 10 && !("answers" in v) && v.perguntas.map((p) => p.chave).join() === conjunto.join() && v.perguntas.every((p) => !p.texto.includes("{voce}")), "vitrine: mesmo conjunto, com o nome no lugar de você, nunca as respostas");
const volta = await svc.conjuntoDe(codigo);
ok(volta.perguntas.map((p) => p.chave).join() === conjunto.join() && volta.relacao === "familia" && v.relacao === "familia", "desafie de volta usa o mesmo conjunto e a mesma relação");
if (conjunto.some((c) => perguntaPorChave(c)?.contexto === "familia")) {
  try { await svc.criar({ nome: "Caio", relacao: "crush", perguntas: conjunto, respostas, consentimento: consent }, dono); ok(false, "relação trocada"); } catch { ok(true, "perguntas de família não passam num desafio de crush"); }
}
try { await svc.criar({ nome: "Caio", relacao: "familia", perguntas: [...conjunto.slice(0, 9), conjunto[0]!], respostas, consentimento: consent }, dono); ok(false, "repetida"); } catch { ok(true, "conjunto com pergunta repetida é recusado"); }
ok((await svc.vitrine(codigo, dono)).proprio === true, "vitrine reconhece o próprio dono");
try { await svc.tentar(codigo, { previsoes: respostas }, dono); ok(false, "dono não pode se prever"); } catch (e) { ok((e as {code?:string}).code === "OWN_CHALLENGE", "dono não pode prever o próprio desafio"); }
const prev = ["B","A","B","D","B","A","D","A","C","B"];
const t1 = await svc.tentar(codigo, { nome: "Marina", previsoes: prev }, null);
ok(t1.score === 8 && t1.total === 10, `placar calculado no servidor (${t1.score}/10)`);
const t2 = await svc.tentar(codigo, { previsoes: respostas }, t1.token);
ok(t2.score === 8, "segunda tentativa do mesmo aparelho mantém o primeiro placar");
ok((await svc.vitrine(codigo, t1.token)).resultado?.score === 8, "convidado que volta vê o próprio placar");
const semConta = await svc.meus(dono, null);
ok(semConta.desafios.length === 1 && semConta.desafios[0]!.tentativas.length === 1 && !("score" in semConta.desafios[0]!.tentativas[0]!), "sem conta: vê que Marina respondeu, sem placar");
const userId = randomUUID();
await adm.query(`INSERT INTO "User"(id,"updatedAt") VALUES ($1,now())`, [userId]);
ok((await svc.reivindicar(dono, userId)) === 1, "cadastro vincula o desafio à conta");
const comConta = await svc.meus(null, userId);
const t0 = comConta.desafios[0]!.tentativas[0]!;
ok("score" in t0 && t0.score === 8, "com conta: placar aparece, mesmo em outro aparelho");
try { await svc.cancelar(codigo, t1.token, null); ok(false, "estranho não cancela"); } catch (e) { ok((e as {status?:number}).status === 404, "quem não criou não consegue cancelar"); }
// Retrato: só respostas com o aviso novo e só com 3 ou mais pessoas por pergunta
const antes = await svc.retrato(dono, null);
ok(antes.perguntas.length === 0, "retrato ignora respostas dadas antes do aviso do retrato");
const aviso = "desafio-retrato-v1" as const;
await svc.tentar(codigo, { nome: "Ana", previsoes: respostas, avisoRetrato: aviso }, null);
await svc.tentar(codigo, { nome: "Leo", previsoes: respostas, avisoRetrato: aviso }, null);
const dois = await svc.retrato(dono, null);
ok(dois.perguntas.length === 0 && dois.pendentes > 0, "com 2 pessoas nenhuma pergunta aparece (ficam pendentes)");
const outras = respostas.map((x) => (x === "A" ? "B" : "A")) as typeof respostas;
await svc.tentar(codigo, { nome: "Bia", previsoes: outras, avisoRetrato: aviso }, null);
const tres = await svc.retrato(dono, null);
ok(tres.perguntas.length === 10 && tres.respondentes === 3 && tres.perguntas.every((p) => p.total === 3 && !("nome" in p)), "com 3 pessoas as perguntas aparecem, sem nomes");
ok(tres.perguntas.every((p) => p.tipo === "acordo" && p.concordam === 2), "2 de 3 concordando conta como acordo");
const est = await svc.estatisticas();
ok((est.get(conjunto[0]!)?.tentativas ?? 0) >= 1, "estatísticas de aprendizado registram cada pergunta");
await svc.cancelar(codigo, dono, null);
try { await svc.vitrine(codigo, null); ok(false, "cancelado"); } catch (e) { ok((e as {status?:number}).status === 404, "convite cancelado para de funcionar"); }
try { await svc.vitrine("AAAAAAAA", null); ok(false, "inexistente"); } catch (e) { ok((e as {status?:number}).status === 404, "código inexistente dá 404"); }
await pool.end(); await adm.end();
console.log("TODOS OS TESTES PASSARAM");
