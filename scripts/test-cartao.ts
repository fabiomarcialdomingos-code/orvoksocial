// Testa o armazenamento do card do convite: desenha uma vez, guarda, entrega pronto, refaz quando a versão muda e some com o convite.
// Uso: AUTH_SECRET=... AUTH_DATABASE_URL=(orvok_auth_runtime) DATABASE_URL=(dono) npx tsx scripts/test-cartao.ts
import { Pool } from "pg";
import { cartaoDoConvite, versaoDoCartao } from "@/lib/desafio/cartao-armazem";
import { AVISO } from "@/lib/desafio/catalogo";
import { DesafioService } from "@/lib/desafio/service";
import { escolherRetrato } from "@/lib/desafio/selecao";

const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
const adm = new Pool({ connectionString: process.env.DATABASE_URL });
const ok = (c: boolean, m: string) => { if (!c) { console.error("FALHOU:", m); process.exit(1); } console.log("ok -", m); };

let desenhos = 0;
const gerar = async (nome: string | null) => { desenhos++; return Buffer.from(`PNG-DE-MENTIRA:${nome}`); };
const svc = new DesafioService(pool);
const chaves = escolherRetrato("amigos", new Map()).map((p) => p.chave);
const { codigo } = await svc.criar({ nome: "Henrique", relacao: "amigos", perguntas: chaves, respostas: chaves.map(() => "A"), consentimento: { aceito: true, versao: AVISO.versao, hash: AVISO.hash } }, null, null);

const a = await cartaoDoConvite(pool, codigo, gerar);
ok(a !== null && a.png.toString() === "PNG-DE-MENTIRA:Henrique" && desenhos === 1, "o primeiro pedido desenha o card");
const b = await cartaoDoConvite(pool, codigo, gerar);
ok(b !== null && b.png.equals(a!.png) && desenhos === 1, "o segundo vem pronto do banco, sem desenhar de novo");
ok(a!.versao === versaoDoCartao("Henrique", "amigos") && a!.versao.length === 12, "a versão muda com o nome e com a relação");
ok(versaoDoCartao("Henrique", "amigos") !== versaoDoCartao("Henrique", "familia") && versaoDoCartao("Henrique", "amigos") !== versaoDoCartao("Carlos", "amigos"), "nome ou relação diferentes dão versões diferentes");
await adm.query(`UPDATE "GuestChallengeCard" SET version='versao-antiga' WHERE "challengeId"=(SELECT id FROM "GuestChallenge" WHERE code=$1)`, [codigo]);
await cartaoDoConvite(pool, codigo, gerar);
ok(desenhos === 2, "um card de versão antiga (desenho mudou) é refeito");
ok(await cartaoDoConvite(pool, "ZZZZZZZZ", gerar) === null && desenhos === 2, "convite que não existe devolve nada e não desenha");

const eventos = async () => Number((await adm.query(`SELECT count(*) AS n FROM "ProductEvent" WHERE name='convite_aberto' AND code=$1`, [codigo])).rows[0].n);
const antes = await eventos();
await svc.resumoPublico(codigo); await svc.resumoPublico(codigo); await cartaoDoConvite(pool, codigo, gerar);
ok(await eventos() === antes, "ler o título ou o card do convite NÃO conta como convite aberto (robôs de prévia não inflam a medição)");
await svc.vitrine(codigo, null);
ok(await eventos() === antes + 1, "abrir o convite de verdade continua contando");

await adm.query(`DELETE FROM "GuestChallenge" WHERE code=$1`, [codigo]);
ok(Number((await adm.query(`SELECT count(*) AS n FROM "GuestChallengeCard"`)).rows[0].n) === Number((await adm.query(`SELECT count(*) AS n FROM "GuestChallengeCard" c JOIN "GuestChallenge" d ON d.id=c."challengeId"`)).rows[0].n), "o card some junto com o convite (nenhum card sobra sem convite)");
await pool.end(); await adm.end();
console.log("TODOS OS TESTES PASSARAM");
