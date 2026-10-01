// Testa o desafio sem cadastro contra um banco migrado.
// Uso: AUTH_SECRET=... AUTH_DATABASE_URL=(papel orvok_auth_runtime) DATABASE_URL=(dono) pnpm test:desafio
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { DesafioService } from "@/lib/desafio/service";
import { AVISO_HASH, AVISO_IDADE_HASH, AVISO_IDADE_VERSAO, AVISO_VERSAO } from "@/lib/desafio/catalogo";
import { NUCLEO, ORDEM_TRACOS } from "@/lib/desafio/nucleo";
import { notas, perfil, selo } from "@/lib/desafio/perfil";
import { escolherDesafio, escolherRetrato } from "@/lib/desafio/selecao";

const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
const adm = new Pool({ connectionString: process.env.DATABASE_URL });
const svc = new DesafioService(pool);
const ok = (c: boolean, m: string) => { if (!c) { console.error("FALHOU:", m); process.exit(1); } console.log("ok -", m); };
const L = ["A", "B", "C", "D"] as const;

// Núcleo
ok(NUCLEO.length === 156 && new Set(NUCLEO.map((p) => p.chave)).size === 156, "núcleo com 156 perguntas únicas");
ok(ORDEM_TRACOS.every((t) => NUCLEO.filter((p) => p.traco === t).length === 26), "26 perguntas por traço (20 gerais + 2 por relação)");
ok(NUCLEO.every((p) => p.pesos.some((w) => w > 0) && p.pesos.some((w) => w < 0)), "toda pergunta tem opções para os dois lados do traço");

// Seleção: dois produtos
for (let i = 0; i < 300; i++) {
  const rel = (["familia", "amigos", "crush"] as const)[i % 3]!;
  const d = escolherDesafio(rel, new Map());
  if (d.length !== 5 || new Set(d.map((p) => p.traco)).size !== 5 || d.some((p) => p.contexto && p.contexto !== rel)) ok(false, "desafio: 5 perguntas de traços diferentes, relação certa");
  const rt = escolherRetrato(rel, new Map());
  const porTraco = ORDEM_TRACOS.map((t) => rt.filter((p) => p.traco === t).length);
  if (rt.length !== 12 || new Set(rt.map((p) => p.chave)).size !== 12 || porTraco.some((n) => n !== 2) || rt.some((p) => p.contexto && p.contexto !== rel)) ok(false, "retrato: 12 perguntas, 2 por traço, relação certa");
}
ok(true, "300 sorteios: desafio com 5 perguntas de 5 traços e retrato com 12 (2 por traço), sempre da relação certa");
const todos = escolherRetrato("amigos", new Map());

// Perfil e selo
const positivo = notas(todos.map((p) => p.chave), todos.map((p) => p.pesos.indexOf(2)));
ok(ORDEM_TRACOS.every((t) => positivo[t] === 1) && perfil(positivo).nome === "O Líder", "respostas no primeiro polo dão O Líder, com 100% em cada traço");
const negativo = notas(todos.map((p) => p.chave), todos.map((p) => p.pesos.indexOf(-2)));
ok(perfil(negativo).nome === "O Sonhador" && perfil(negativo).marcantes.join() === "Intenso,Caseiro,Cuidador", "respostas no segundo polo dão O Sonhador: Intenso, Caseiro, Cuidador");
ok(selo(positivo, positivo).nivel === "autentico" && selo(positivo, negativo).nivel === null, "selo autêntico quando os 6 traços batem");

// Serviço: retrato (12, o amigo opina, anônimo)
const conjunto = todos.map((p) => p.chave);
const respostas = todos.map((p) => L[p.pesos.indexOf(2)]!);
const consent = { aceito: true, versao: AVISO_VERSAO, hash: AVISO_HASH };
const consentIdade = { aceito: true as const, versao: AVISO_IDADE_VERSAO, hash: AVISO_IDADE_HASH };
const avisoRetrato = "retrato-opiniao-v1" as const;
ok(svc.diagnostico({ perguntas: conjunto, respostas }).nome === "O Líder", "diagnóstico do retrato logo após as 12 perguntas");
const { codigo, token: dono } = await svc.criar({ nome: "Caio", relacao: "amigos", tipo: "retrato", perguntas: conjunto, respostas, consentimento: consent }, null);
ok(/^[A-HJ-NP-Z2-9]{8}$/.test(codigo), `retrato criado (${codigo})`);
const v = await svc.vitrine(codigo, null);
ok(v.tipo === "retrato" && v.perguntas.length === 12 && !("answers" in v) && v.avisoIdade.versao === AVISO_IDADE_VERSAO, "vitrine do retrato: 12 perguntas, sem respostas, com aviso de idade");
try { await svc.tentar(codigo, { nome: "Sem idade", previsoes: respostas, avisoRetrato }, null); ok(false, "sem idade"); } catch { ok(true, "resposta sem confirmar 16 anos é recusada"); }
try { await svc.tentar(codigo, { nome: "Sem aviso", previsoes: respostas, consentimentoIdade: consentIdade }, null); ok(false, "sem aviso"); } catch { ok(true, "no retrato, quem responde precisa aceitar o aviso de opinião anônima"); }
// Opiniões: todos enxergam o Caio do jeito oposto ao que ele se vê.
const opostas = todos.map((p) => L[p.pesos.indexOf(-2)]!);
await svc.tentar(codigo, { nome: "Leo", previsoes: opostas, avisoRetrato, consentimentoIdade: consentIdade }, null);
await svc.tentar(codigo, { nome: "Bia", previsoes: opostas, avisoRetrato, consentimentoIdade: consentIdade }, null);
const dois = await svc.retrato(dono, null);
ok(dois.eu?.nome === "O Líder" && dois.eles === null && dois.faltam === 1, "com 2 opiniões: você se vê, mas o 'como te veem' ainda não aparece");
const r3 = await svc.tentar(codigo, { nome: "Rui", previsoes: opostas, avisoRetrato, consentimentoIdade: consentIdade }, null);
ok(r3.score === 0 && r3.tipo === "retrato", "no retrato não há placar");
const tres = await svc.retrato(dono, null);
ok(tres.eles?.nome === "O Sonhador" && tres.selo?.nivel === null && tres.respondentes === 3, "com 3 opiniões: te veem como O Sonhador (o oposto) e sem selo");
const meus = await svc.meus(dono, null);
ok(meus.desafios[0]!.tipo === "retrato" && meus.desafios[0]!.tentativas.every((t) => t.nome === null && !("score" in t)), "na lista do dono, o retrato não mostra nomes nem placar");

// Serviço: desafio (5, o amigo adivinha, placar) não entra no retrato
const cinco = escolherDesafio("amigos", new Map());
const resp5 = cinco.map((p) => L[p.pesos.indexOf(2)]!);
const des = await svc.criar({ nome: "Caio", relacao: "amigos", tipo: "desafio", perguntas: cinco.map((p) => p.chave), respostas: resp5, consentimento: consent }, dono);
const placar = await svc.tentar(des.codigo, { nome: "Ana", previsoes: resp5, consentimentoIdade: consentIdade }, null);
ok(placar.score === 5 && placar.total === 5, "desafio de 5 perguntas devolve o placar (5 de 5)");
ok((await svc.retrato(dono, null)).respondentes === 3, "palpites do desafio não entram no 'como te veem'");
try { await svc.criar({ nome: "X", relacao: "amigos", tipo: "desafio", perguntas: conjunto, respostas, consentimento: consent }, null); ok(false, "12 num desafio"); } catch { ok(true, "desafio com 12 perguntas é recusado"); }

const userId = randomUUID();
await adm.query(`INSERT INTO "User"(id,"updatedAt") VALUES ($1,now())`, [userId]);
ok((await svc.reivindicar(dono, userId)) === 2 && (await svc.retrato(null, userId)).respondentes === 3, "retrato e desafio acompanham a conta depois do cadastro");

// Denúncia e bloqueio
const { codigo: codigo2, token: dono2 } = await svc.criar({ nome: "Marina", relacao: "amigos", tipo: "desafio", perguntas: cinco.map((p) => p.chave), respostas: resp5, consentimento: consent }, null);
const denuncia = await svc.denunciar(codigo2, { motivo: "Mensagem incômoda junto do link." }, null, null);
ok(denuncia.nome === "Marina" && typeof denuncia.token === "string", "denúncia registrada e devolve um token de aparelho");
const { token: bloqueador } = await svc.bloquear(codigo2, null, null);
try { await svc.vitrine(codigo2, bloqueador, null); ok(false, "bloqueado ainda vê a vitrine"); } catch (e) { ok((e as { code?: string }).code === "BLOCKED", "quem bloqueou não abre mais o convite dessa pessoa"); }
try { await svc.tentar(codigo2, { nome: "Bloqueado", previsoes: resp5, consentimentoIdade: consentIdade }, bloqueador); ok(false, "bloqueado ainda prevê"); } catch (e) { ok((e as { code?: string }).code === "BLOCKED", "quem bloqueou também não consegue prever essa pessoa"); }
const outraPessoa = await svc.vitrine(codigo2, null, null);
ok(outraPessoa.nome === "Marina", "o bloqueio não afeta quem mais recebeu o mesmo link");
try { await svc.bloquear(codigo2, dono2, null); ok(false, "dono bloqueia a si mesmo"); } catch (e) { ok((e as { code?: string }).code === "OWN_CHALLENGE", "quem criou o desafio não pode bloquear a si mesmo"); }

await svc.cancelar(codigo, dono, null);
try { await svc.vitrine(codigo, null); ok(false, "cancelado"); } catch (e) { ok((e as { status?: number }).status === 404, "convite cancelado para de funcionar"); }
await pool.end(); await adm.end();
console.log("TODOS OS TESTES PASSARAM");
