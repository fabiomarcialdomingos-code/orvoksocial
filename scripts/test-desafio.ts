// Testa o desafio sem cadastro contra um banco migrado.
// Uso: AUTH_SECRET=... AUTH_DATABASE_URL=(papel orvok_auth_runtime) DATABASE_URL=(dono) pnpm test:desafio
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { DesafioService } from "@/lib/desafio/service";
import { AVISO_HASH, AVISO_IDADE_HASH, AVISO_IDADE_VERSAO, AVISO_VERSAO } from "@/lib/desafio/catalogo";
import { NUCLEO, ORDEM_TRACOS } from "@/lib/desafio/nucleo";
import { notas, perfil, selo } from "@/lib/desafio/perfil";
import { escolherAberturaNucleo, escolherReforcoNucleo } from "@/lib/desafio/selecao";

const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
const adm = new Pool({ connectionString: process.env.DATABASE_URL });
const svc = new DesafioService(pool);
const ok = (c: boolean, m: string) => { if (!c) { console.error("FALHOU:", m); process.exit(1); } console.log("ok -", m); };
const L = ["A", "B", "C", "D"] as const;

// Núcleo
ok(NUCLEO.length === 156 && new Set(NUCLEO.map((p) => p.chave)).size === 156, "núcleo com 156 perguntas únicas");
ok(ORDEM_TRACOS.every((t) => NUCLEO.filter((p) => p.traco === t).length === 26), "26 perguntas por traço (20 gerais + 2 por relação)");
ok(NUCLEO.every((p) => p.pesos.some((w) => w > 0) && p.pesos.some((w) => w < 0)), "toda pergunta tem opções para os dois lados do traço");

// Seleção
for (let i = 0; i < 300; i++) {
  const rel = (["familia", "amigos", "crush"] as const)[i % 3]!;
  const ab = escolherAberturaNucleo(rel, new Map());
  if (ab.length !== 6 || new Set(ab.map((p) => p.traco)).size !== 6 || ab.some((p) => p.contexto && p.contexto !== rel)) ok(false, "abertura: 6 traços, relação certa");
  const resp = ab.map((p) => ({ chave: p.chave, opcao: Math.floor(Math.random() * 4) }));
  const rf = escolherReforcoNucleo(resp, rel, new Map());
  const todas = [...ab, ...rf];
  if (rf.length !== 4 || new Set(todas.map((p) => p.chave)).size !== 10 || rf.some((p) => p.contexto && p.contexto !== rel)) ok(false, "reforço: 4 novas, relação certa");
}
ok(true, "300 sorteios: abertura cobre os 6 traços e o reforço traz 4 perguntas novas da relação certa");
const abertura = escolherAberturaNucleo("amigos", new Map());
const certeza = abertura.map((p, i) => ({ chave: p.chave, opcao: i < 5 ? p.pesos.indexOf(2) : p.pesos.indexOf(1) }));
const reforco = escolherReforcoNucleo(certeza, "amigos", new Map());
ok(reforco[0]!.traco === abertura[5]!.traco, "reforço começa pelo traço em que a pessoa ficou mais em cima do muro");

// Perfil e selo
const todos = [...abertura, ...reforco];
const positivo = notas(todos.map((p) => p.chave), todos.map((p) => p.pesos.indexOf(2)));
ok(ORDEM_TRACOS.every((t) => positivo[t] === 1) && perfil(positivo).nome === "O Líder", "respostas no primeiro polo dão O Líder, com 100% em cada traço");
const negativo = notas(todos.map((p) => p.chave), todos.map((p) => p.pesos.indexOf(-2)));
ok(perfil(negativo).nome === "O Sonhador" && perfil(negativo).marcantes.join() === "Intenso,Caseiro,Cuidador", "respostas no segundo polo dão O Sonhador: Intenso, Caseiro, Cuidador");
ok(selo(positivo, positivo).nivel === "autentico" && selo(positivo, negativo).nivel === null, "selo autêntico quando os 6 traços batem");

// Serviço
const conjunto = todos.map((p) => p.chave);
const respostas = todos.map((p) => L[p.pesos.indexOf(2)]!);
const consent = { aceito: true, versao: AVISO_VERSAO, hash: AVISO_HASH };
const consentIdade = { aceito: true as const, versao: AVISO_IDADE_VERSAO, hash: AVISO_IDADE_HASH };
ok(svc.diagnostico({ perguntas: conjunto, respostas }).nome === "O Líder", "diagnóstico logo após as perguntas");
const { codigo, token: dono } = await svc.criar({ nome: "Caio", relacao: "amigos", perguntas: conjunto, respostas, consentimento: consent }, null);
ok(/^[A-HJ-NP-Z2-9]{8}$/.test(codigo), `desafio criado (${codigo})`);
const v = await svc.vitrine(codigo, null);
ok(v.perguntas.length === 10 && v.perguntas.every((p) => !p.texto.includes("{voce}")) && !("answers" in v), "vitrine com o nome no lugar de você, sem respostas");
ok(v.avisoIdade.versao === AVISO_IDADE_VERSAO, "vitrine devolve o aviso de idade para quem vai prever");
try { await svc.tentar(codigo, { previsoes: respostas, consentimentoIdade: consentIdade }, dono); ok(false, "dono"); } catch (e) { ok((e as { code?: string }).code === "OWN_CHALLENGE", "dono não prevê o próprio desafio"); }
try { await svc.tentar(codigo, { nome: "Sem idade", previsoes: respostas }, null); ok(false, "sem consentimento de idade"); } catch { ok(true, "tentativa sem confirmar 16 anos é recusada"); }
const aviso = "desafio-retrato-v1" as const;
await svc.tentar(codigo, { nome: "Ana", previsoes: respostas, consentimentoIdade: consentIdade }, null);
ok((await svc.retrato(dono, null)).eles === null, "respostas sem o aviso do retrato não contam");
await svc.tentar(codigo, { nome: "Leo", previsoes: respostas, avisoRetrato: aviso, consentimentoIdade: consentIdade }, null);
await svc.tentar(codigo, { nome: "Bia", previsoes: respostas, avisoRetrato: aviso, consentimentoIdade: consentIdade }, null);
const dois = await svc.retrato(dono, null);
ok(dois.eu?.nome === "O Líder" && dois.eles === null && dois.faltam === 1, "com 2 pessoas: você se vê, mas o 'como te veem' ainda não aparece");
await svc.tentar(codigo, { nome: "Rui", previsoes: respostas, avisoRetrato: aviso, consentimentoIdade: consentIdade }, null);
const tres = await svc.retrato(dono, null);
ok(tres.eles?.nome === "O Líder" && tres.selo?.nivel === "autentico" && tres.respondentes === 3, "com 3 pessoas: como te veem e Selo Autêntico");
const userId = randomUUID();
await adm.query(`INSERT INTO "User"(id,"updatedAt") VALUES ($1,now())`, [userId]);
ok((await svc.reivindicar(dono, userId)) === 1 && (await svc.retrato(null, userId)).selo?.nivel === "autentico", "retrato acompanha a conta depois do cadastro");

// Denúncia e bloqueio
const { codigo: codigo2, token: dono2 } = await svc.criar({ nome: "Marina", relacao: "amigos", perguntas: conjunto, respostas, consentimento: consent }, null);
const denuncia = await svc.denunciar(codigo2, { motivo: "Mensagem incômoda junto do link." }, null, null);
ok(denuncia.nome === "Marina" && typeof denuncia.token === "string", "denúncia registrada e devolve um token de aparelho");
const { token: bloqueador } = await svc.bloquear(codigo2, null, null);
try { await svc.vitrine(codigo2, bloqueador, null); ok(false, "bloqueado ainda vê a vitrine"); } catch (e) { ok((e as { code?: string }).code === "BLOCKED", "quem bloqueou não abre mais o convite dessa pessoa"); }
try { await svc.tentar(codigo2, { nome: "Bloqueado", previsoes: respostas, consentimentoIdade: consentIdade }, bloqueador); ok(false, "bloqueado ainda prevê"); } catch (e) { ok((e as { code?: string }).code === "BLOCKED", "quem bloqueou também não consegue prever essa pessoa"); }
const outraPessoa = await svc.vitrine(codigo2, null, null);
ok(outraPessoa.nome === "Marina", "o bloqueio não afeta quem mais recebeu o mesmo link");
try { await svc.bloquear(codigo2, dono2, null); ok(false, "dono bloqueia a si mesmo"); } catch (e) { ok((e as { code?: string }).code === "OWN_CHALLENGE", "quem criou o desafio não pode bloquear a si mesmo"); }

await svc.cancelar(codigo, dono, null);
try { await svc.vitrine(codigo, null); ok(false, "cancelado"); } catch (e) { ok((e as { status?: number }).status === 404, "convite cancelado para de funcionar"); }
await pool.end(); await adm.end();
console.log("TODOS OS TESTES PASSARAM");
