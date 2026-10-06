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

// O banco de teste persiste entre rodadas: limpa o que esta suíte cria na Estante.
await adm.query(`DELETE FROM "ShelfPerson" WHERE "inviteCode" IN ('TESTE0A1','TESTE0C1','VELHA001','VELHA002','VELHA003','NOVA0001')`);
// Estante: a Ana e o Caio trocam uma lembrança cada um (inseridas direto, sem passar pela moderação)
const pEA = randomUUID(), pEC = randomUUID();
await adm.query(`INSERT INTO "ShelfPerson"(id,"userId",name,"inviteCode","ageConsentVersion") VALUES ($1,$2,'Ana','TESTE0A1','x'),($3,$4,'Caio','TESTE0C1','x')`, [pEA, ana, pEC, caio]);
const [bA, bB] = pEA < pEC ? [pEA, pEC] : [pEC, pEA];
await adm.query(`INSERT INTO "ShelfBond"(id,"personA","personB") VALUES ($1,$2,$3)`, [randomUUID(), bA, bB]);
await adm.query(`INSERT INTO "Keepsake"(id,code,"fromId","toId",title,note,predicted,reaction,"reactedAt") VALUES ($1,'TSTE0001',$2,$3,'Presente do Caio','Frase do Caio',2,5,now())`, [randomUUID(), pEC, pEA]);
await adm.query(`INSERT INTO "Keepsake"(id,code,"fromId","toId",title,note,predicted) VALUES ($1,'TSTE0002',$2,$3,'Presente da Ana','Frase da Ana',4)`, [randomUUID(), pEA, pEC]);

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
const estAna = (e as unknown as { estante: { lembrancasRecebidas: Record<string, unknown>[]; lembrancasQueDei: Record<string, unknown>[]; circulo: { nome: string }[] } }).estante;
ok(estAna.lembrancasRecebidas.length === 1 && estAna.lembrancasRecebidas[0]!.objeto === "Presente do Caio" && estAna.lembrancasRecebidas[0]!.minhaReacao === 5, "a exportação traz a Estante: o que a Ana recebeu e a reação dela");
ok(estAna.lembrancasQueDei.length === 1 && estAna.lembrancasQueDei[0]!.quantoAchei === 4 && estAna.circulo[0]!.nome === "Caio", "e o que ela deu (com o quanto achou) e o círculo");
ok(!JSON.stringify(estAna.lembrancasRecebidas).includes("quantoAchei") && !JSON.stringify(estAna.lembrancasRecebidas).includes("previsao"), "quem recebeu não ganha na exportação a previsão de quem deu");

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
ok((eDepois as unknown as { estante: unknown }).estante === null, "depois da exclusão, a Estante da Ana também some");
ok((eCaioDepois as unknown as { estante: { lembrancasRecebidas: unknown[] } | null }).estante !== null, "e a do Caio continua");

// prazos prometidos na Política de privacidade: aplicados pelo job diário
const velha = randomUUID(), velhaAtiva = randomUUID(), nova = randomUUID();
await adm.query(`INSERT INTO "ShelfPerson"(id,"tokenHash",name,"inviteCode","createdAt") VALUES ($1,$2,'Velha','VELHA001',now()-interval '13 months')`, [velha, "a".repeat(64)]);
await adm.query(`INSERT INTO "ShelfPerson"(id,"tokenHash",name,"inviteCode","createdAt") VALUES ($1,$2,'VelhaAtiva','VELHA002',now()-interval '13 months')`, [velhaAtiva, "b".repeat(64)]);
await adm.query(`INSERT INTO "ShelfPerson"(id,"tokenHash",name,"inviteCode") VALUES ($1,$2,'Nova','NOVA0001')`, [nova, "c".repeat(64)]);
await adm.query(`INSERT INTO "Keepsake"(id,code,"fromId","toId",title,predicted,"createdAt") VALUES ($1,'TSTE0003',$2,$3,'Recente',3,now())`, [randomUUID(), velhaAtiva, nova]);
await adm.query(`INSERT INTO "ShelfModerationLog"("personId",kind,ok,reason,"createdAt") VALUES ($1,'texto',false,'assedio',now()-interval '100 days'),($1,'texto',true,'ok',now())`, [nova]);
execFileSync("psql", [process.env.DATABASE_URL!, "-v", "ON_ERROR_STOP=1", "-q", "-f", "scripts/avisar-eventos.sql"], { encoding: "utf8" });
const existe = async (id: string) => Number((await adm.query(`SELECT count(*) AS n FROM "ShelfPerson" WHERE id=$1`, [id])).rows[0].n) === 1;
ok(!(await existe(velha)), "quem usa a Estante sem conta e ficou 12 meses parado é apagado");
ok((await existe(velhaAtiva)) && (await existe(nova)), "quem teve atividade recente (ou é novo) fica");
ok(Number((await adm.query(`SELECT count(*) AS n FROM "ShelfModerationLog" WHERE "personId"=$1`, [nova])).rows[0].n) === 1, "o registro da moderação com mais de 90 dias é apagado");


await pool.end(); await adm.end();
console.log("TODOS OS TESTES PASSARAM");
