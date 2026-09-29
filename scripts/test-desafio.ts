// Testa o desafio sem cadastro contra um banco migrado.
// Uso: AUTH_SECRET=... AUTH_DATABASE_URL=(papel orvok_auth_runtime) DATABASE_URL=(dono) pnpm test:desafio
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { DesafioService } from "@/lib/desafio/service";
import { AVISO_HASH, AVISO_VERSAO } from "@/lib/desafio/catalogo";

const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
const adm = new Pool({ connectionString: process.env.DATABASE_URL });
const svc = new DesafioService(pool);
const ok = (c: boolean, m: string) => { if (!c) { console.error("FALHOU:", m); process.exit(1); } console.log("ok -", m); };
const respostas = ["B","A","B","D","B","A","D","D","C","C"];
const consent = { aceito: true, versao: AVISO_VERSAO, hash: AVISO_HASH };

const { codigo, token: dono } = await svc.criar({ nome: "  Caio  ", respostas, consentimento: consent }, null);
ok(/^[A-HJ-NP-Z2-9]{8}$/.test(codigo) && dono.length === 43, `desafio criado (${codigo})`);
try { await svc.criar({ nome: "Caio", respostas, consentimento: { ...consent, hash: "0".repeat(64) } }, dono); ok(false, "hash inválido deveria falhar"); } catch { ok(true, "consentimento com hash errado é recusado"); }
const v = await svc.vitrine(codigo, null);
ok(v.nome === "Caio" && v.perguntas.length === 10 && !("answers" in v) && v.perguntas[0]!.texto.includes("Caio"), "vitrine mostra nome e perguntas, nunca respostas");
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
try { await svc.vitrine("AAAAAAAA", null); ok(false, "inexistente"); } catch (e) { ok((e as {status?:number}).status === 404, "código inexistente dá 404"); }
await pool.end(); await adm.end();
console.log("TODOS OS TESTES PASSARAM");
