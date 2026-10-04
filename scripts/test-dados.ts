// Testa a exportação (LGPD) de convites, retrato, Mundo e conversas, e o script de exclusão.
// Uso: AUTH_SECRET=... AUTH_DATABASE_URL=(orvok_auth_runtime) DATABASE_URL=(dono) npx tsx scripts/test-dados.ts
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { exportarConvitesEMundo } from "@/lib/api/dados-convites";
import { AVISO_HASH, AVISO_IDADE_HASH, AVISO_IDADE_VERSAO, AVISO_VERSAO } from "@/lib/desafio/catalogo";
import { escolherRetrato } from "@/lib/desafio/selecao";
import { DesafioService } from "@/lib/desafio/service";
import { MundoService } from "@/lib/mundo/service";

const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
const adm = new Pool({ connectionString: process.env.DATABASE_URL });
const des = new DesafioService(pool), mundo = new MundoService(pool);
const ok = (c: boolean, m: string) => { if (!c) { console.error("FALHOU:", m); process.exit(1); } console.log("ok -", m); };
const L = ["A", "B", "C", "D"] as const;
const idade = { aceito: true as const, versao: AVISO_IDADE_VERSAO, hash: AVISO_IDADE_HASH };
const consent = { aceito: true, versao: AVISO_VERSAO, hash: AVISO_HASH };

const ana = randomUUID(), caio = randomUUID();
for (const u of [ana, caio]) await adm.query(`INSERT INTO "User"(id,"updatedAt") VALUES ($1,now())`, [u]);
const perguntas = escolherRetrato("amigos", new Map());
const respostas = perguntas.map((p) => L[p.pesos.indexOf(2)]!);
const chaves = perguntas.map((p) => p.chave);

// Ana cria um convite (no aparelho dela), e Caio e um desconhecido compartilham a visão sobre ela.
const conviteAna = await des.criar({ nome: "Ana", relacao: "amigos", perguntas: chaves, respostas, consentimento: consent }, null);
await des.reivindicar(conviteAna.token, ana);
const visaoCaio = await des.tentar(conviteAna.codigo, { nome: "Caio", previsoes: respostas, avisoRetrato: "retrato-opiniao-v1", consentimentoIdade: idade }, null, caio);
await des.tentar(conviteAna.codigo, { nome: "Segredo Anônimo", previsoes: respostas, avisoRetrato: "retrato-opiniao-v1", consentimentoIdade: idade }, null);
// Ana também compartilha a visão dela sobre o convite do Caio.
const conviteCaio = await des.criar({ nome: "Caio", relacao: "amigos", perguntas: chaves, respostas, consentimento: consent }, null);
await des.reivindicar(conviteCaio.token, caio);
await des.tentar(conviteCaio.codigo, { nome: "Ana", previsoes: respostas, avisoRetrato: "retrato-opiniao-v1", consentimentoIdade: idade }, null, ana);
await des.marcarOculto({ traco: "reacao", oculto: true }, conviteAna.token, ana);

// Mundo e conversa: Ana abre, Caio opina, o evento termina, conversam.
const cat = (await adm.query(`SELECT id FROM "WorldCategory" WHERE slug='esporte'`)).rows[0]?.id ?? randomUUID();
await adm.query(`INSERT INTO "WorldCategory"(id,slug,name) VALUES ($1,'esporte','esporte') ON CONFLICT (slug) DO NOTHING`, [cat]);
const catId = (await adm.query(`SELECT id FROM "WorldCategory" WHERE slug='esporte'`)).rows[0].id;
const evento = randomUUID(), sim = randomUUID(), nao = randomUUID();
await adm.query(`INSERT INTO "WorldEvent"(id,"categoryId",title,"resolutionCriteria","opensAt","closesAt",status,"createdById") VALUES ($1,$2,'Evento da exportação','teste',now()-interval '1 hour',now()+interval '1 day','PUBLISHED',$3)`, [evento, catId, ana]);
await adm.query(`INSERT INTO "WorldOpportunity"(id,"eventId",code,label,position) VALUES ($1,$3,'S','Sim',0),($2,$3,'N','Não',1)`, [sim, nao, evento]);
const rodada = await mundo.criar({ eventoId: evento, modo: "ser_previsto", resposta: sim, nome: "Ana" }, ana);
const caioNaRodada = await mundo.participar(rodada.codigo, { nome: "Caio", opcao: nao, consentimentoIdade: idade }, null, caio);
await adm.query(`UPDATE "WorldEvent" SET "closesAt"=now()-interval '1 minute' WHERE id=$1`, [evento]);
await mundo.agirNaConversa(rodada.codigo, { acao: "confirmar_idade", consentimentoIdade: idade }, null, ana);
await mundo.agirNaConversa(rodada.codigo, { acao: "propor" }, caioNaRodada.token, caio);
await mundo.agirNaConversa(rodada.codigo, { acao: "aceitar" }, null, ana);
await mundo.agirNaConversa(rodada.codigo, { acao: "enviar", texto: "Mensagem secreta da Ana para o Caio." }, null, ana);
await mundo.agirNaConversa(rodada.codigo, { acao: "enviar", texto: "Resposta do Caio para a Ana." }, caioNaRodada.token, caio);

// ---- Exportação da Ana
const e = await exportarConvitesEMundo(pool, ana, null);
const json = JSON.stringify(e);
ok(e.convites.length === 1 && e.convites[0]!.codigo === conviteAna.codigo && e.convites[0]!.minhasRespostas.length === 12, "a exportação traz o convite da Ana com as 12 respostas dela, em texto legível");
ok(e.convites[0]!.minhasRespostas.every((r) => r.pergunta.length > 5 && r.resposta.length > 1 && !/^[A-D]$/.test(r.resposta)), "perguntas e respostas saem como texto, não como letras soltas");
ok(e.convites[0]!.visoesRecebidas === 2 && !json.includes("Segredo Anônimo"), "as visões recebidas aparecem só como contagem: quem respondeu de forma anônima não é identificado");
ok(e.visoesQueCompartilhei.length === 1 && e.visoesQueCompartilhei[0]!.sobre === "Caio" && e.visoesQueCompartilhei[0]!.minhasRespostas.length === 12, "a visão que a Ana compartilhou sobre o Caio está na exportação");
ok(e.tracosQueGuardoSoParaMim.includes("reacao"), "o traço oculto da Ana está na exportação");
ok(e.confirmacaoDeIdade?.versao === AVISO_IDADE_VERSAO, "a confirmação de idade está na exportação");
ok(e.mundo.length === 1 && e.mundo[0]!.minhaOpiniao === "Sim" && e.mundo[0]!.com === "Caio", "a conversa do Mundo traz a opinião da Ana e com quem foi");
ok(e.conversas.length === 1 && e.conversas[0]!.mensagens.length === 2 && e.conversas[0]!.mensagens[0]!.minha === true && e.conversas[0]!.mensagens[1]!.minha === false, "a conversa privada traz as duas mensagens, marcando quais são da Ana");
ok(!json.includes("Hash") && !/[0-9a-f]{64}/.test(json), "a exportação não traz hashes nem identificadores técnicos de aparelho");
// quem tem outra conta não enxerga a conversa
const eCaio = await exportarConvitesEMundo(pool, caio, caioNaRodada.token);
ok(eCaio.conversas.length === 1 && eCaio.conversas[0]!.com === "Ana" && eCaio.conversas[0]!.mensagens.length === 2, "o Caio vê a conversa dele, com a Ana, e as mesmas duas mensagens");
ok(eCaio.convites.length === 1 && eCaio.convites[0]!.codigo === conviteCaio.codigo, "o Caio vê só o convite dele, não o da Ana");
ok(eCaio.visoesQueCompartilhei.length === 1 && eCaio.visoesQueCompartilhei[0]!.sobre === "Ana", "a visão que o Caio compartilhou sobre a Ana está na exportação dele");
ok(!JSON.stringify(eCaio.convites).includes("Ana"), "o convite do Caio não mostra dados da Ana");
void visaoCaio;

// ---- Script de exclusão (aplicado ao banco de teste como dono)
const conexao = process.env.DATABASE_URL!;
const saida = execFileSync("psql", [conexao, "-v", "ON_ERROR_STOP=1", "-v", `usuario=${ana}`, "-f", "scripts/apagar-dados-da-conta.sql"], { encoding: "utf8" });
ok(saida.includes("COMMIT"), "o script de exclusão roda inteiro, em transação");
const eDepois = await exportarConvitesEMundo(pool, ana, null);
ok(eDepois.convites.length === 0 && eDepois.visoesQueCompartilhei.length === 0 && eDepois.tracosQueGuardoSoParaMim.length === 0 && eDepois.confirmacaoDeIdade === null && eDepois.conversas.length === 0 && eDepois.mundo.length === 0, "depois da exclusão, não sobra nada da Ana nas tabelas de convites, retrato, Mundo e conversas");
const eCaioDepois = await exportarConvitesEMundo(pool, caio, caioNaRodada.token);
ok(eCaioDepois.convites.length === 1, "a exclusão da Ana não apaga o convite do Caio");

await pool.end(); await adm.end();
console.log("TODOS OS TESTES PASSARAM");
