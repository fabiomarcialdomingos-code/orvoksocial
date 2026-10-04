// Testa o Mundo entre pessoas contra um banco migrado.
// Uso: AUTH_SECRET=... AUTH_DATABASE_URL=(orvok_auth_runtime) DATABASE_URL=(dono) npx tsx scripts/test-mundo.ts
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { AVISO_IDADE_HASH, AVISO_IDADE_VERSAO } from "@/lib/desafio/catalogo";
import { MundoService } from "@/lib/mundo/service";

const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
const adm = new Pool({ connectionString: process.env.DATABASE_URL });
const svc = new MundoService(pool);
const ok = (c: boolean, m: string) => { if (!c) { console.error("FALHOU:", m); process.exit(1); } console.log("ok -", m); };
const idade = { aceito: true as const, versao: AVISO_IDADE_VERSAO, hash: AVISO_IDADE_HASH };

const fabio = randomUUID(), cat = randomUUID();
await adm.query(`INSERT INTO "User"(id,"updatedAt") VALUES ($1,now())`, [fabio]);
await adm.query(`INSERT INTO "WorldCategory"(id,slug,name) VALUES ($1,'esporte','esporte') ON CONFLICT (slug) DO NOTHING`, [cat]);
const catId = (await adm.query(`SELECT id FROM "WorldCategory" WHERE slug='esporte'`)).rows[0].id;
async function evento(titulo: string, minutos: number) {
  const id = randomUUID(), sim = randomUUID(), nao = randomUUID();
  await adm.query(`INSERT INTO "WorldEvent"(id,"categoryId",title,"resolutionCriteria","opensAt","closesAt",status,"createdById") VALUES ($1,$2,$3,'teste',now()-interval '1 hour',now()+($4::int * interval '1 minute'),'PUBLISHED',$5)`, [id, catId, titulo, minutos, fabio]);
  await adm.query(`INSERT INTO "WorldOpportunity"(id,"eventId",code,label,position) VALUES ($1,$3,'S','Sim',0),($2,$3,'N','Não',1)`, [sim, nao, id]);
  return { id, sim, nao };
}

const jogo = await evento("O Palmeiras será campeão?", 60 * 24);
ok((await svc.eventosAbertos()).some((e) => e.id === jogo.id && e.categoria === "esporte"), "evento aberto aparece com a categoria");

// Responder primeiro: quem abre a conversa dá a sua opinião agora e convida
const { codigo } = await svc.criar({ eventoId: jogo.id, modo: "ser_previsto", resposta: jogo.sim, nome: "Fabio" }, fabio);
const v1 = await svc.verComoConvidado(codigo, null);
ok(v1.minhaVez && v1.revelacao === null && v1.minhaOpiniao === null, "convidado vê o assunto, mas não a opinião do Fabio");
const p = await svc.participar(codigo, { nome: "Marina", opcao: jogo.sim, consentimentoIdade: idade }, null, null);
ok(p.estado === "aguardando_revelacao" && p.revelacao === null && p.minhaOpiniao === "Sim", "opinião registrada e nada revelado antes do evento");
try { await svc.participar(codigo, { nome: "Outra", opcao: jogo.nao, consentimentoIdade: idade }, null, null); ok(false, "segunda pessoa"); } catch { ok(true, "a rodada fica com o primeiro aparelho que respondeu"); }
const lista = await svc.minhas(fabio, null);
ok(lista[0]!.estado === "aguardando_revelacao" && lista[0]!.revelacao === null && lista[0]!.minhaOpiniao === "Sim", "Fabio vê a própria opinião, mas não a da Marina");
await adm.query(`UPDATE "WorldEvent" SET "closesAt"=now()-interval '1 minute' WHERE id=$1`, [jogo.id]);
const rev = await svc.verComoConvidado(codigo, p.token);
ok(rev.estado === "revelada" && rev.revelacao?.igual === true && rev.revelacao.primeiraOpiniao === "Sim", "depois do evento: Fabio e Marina pensaram igual");

// Quero prever alguém + "não sei"
const filme = await evento("O filme vai ganhar o Oscar?", 60 * 24);
const r2 = await svc.criar({ eventoId: filme.id, modo: "prever", nome: "Fabio" }, fabio);
const g = await svc.participar(r2.codigo, { nome: "Bia", opcao: filme.nao, consentimentoIdade: idade }, null, null);
ok(g.estado === "aguardando_criador" && g.minhaOpiniao === "Não", "Bia compartilhou a opinião dela; agora é a vez do Fabio");
const avisoFabio = await adm.query(`SELECT 1 FROM "Notification" WHERE "recipientId"=$1 AND "eventType"='MUNDO_SUA_VEZ'`, [fabio]);
ok((avisoFabio.rowCount ?? 0) === 1, "Fabio recebe um aviso de que é a vez dele de responder");
try { await svc.participar(r2.codigo, { nome: "Bia", opcao: null, consentimentoIdade: idade }, g.token, null); ok(false, "nao sei como opiniao"); } catch { ok(true, "a própria opinião não pode ser 'não sei' nem ser trocada"); }
const pal = await svc.opinar(r2.codigo, { opcao: null }, fabio);
ok(pal.estado === "aguardando_revelacao", "Fabio escolheu 'não sei'");
await adm.query(`UPDATE "WorldEvent" SET "closesAt"=now()-interval '1 minute' WHERE id=$1`, [filme.id]);
const rev2 = (await svc.minhas(fabio, null)).find((x) => x.codigo === r2.codigo)!;
ok(rev2.revelacao?.semOpiniao === true && rev2.revelacao.igual === false && rev2.revelacao.primeiraOpiniao === "Não", "'prefiro não opinar' aparece separado, sem contar como igual nem diferente");

// Evento cancelado e evento que terminou sem os dois responderem
const cancelado = await evento("Evento cancelado", 60 * 24);
const r3 = await svc.criar({ eventoId: cancelado.id, modo: "ser_previsto", resposta: cancelado.sim, nome: "Fabio" }, fabio);
await adm.query(`UPDATE "WorldEvent" SET status='CANCELLED' WHERE id=$1`, [cancelado.id]);
ok((await svc.minhas(fabio, null)).find((x) => x.codigo === r3.codigo)?.estado === "cancelada", "evento cancelado: a rodada não conta");
const vazio = await evento("Ninguém respondeu", 60 * 24);
const r4 = await svc.criar({ eventoId: vazio.id, modo: "ser_previsto", resposta: vazio.sim, nome: "Fabio" }, fabio);
await adm.query(`UPDATE "WorldEvent" SET "closesAt"=now()-interval '1 minute' WHERE id=$1`, [vazio.id]);
ok((await svc.minhas(fabio, null)).find((x) => x.codigo === r4.codigo)?.estado === "sem_comparacao", "terminou sem a segunda opinião: sem comparação, não entra na conta");
try { await svc.criar({ eventoId: vazio.id, modo: "prever", nome: "Fabio" }, fabio); ok(false, "evento encerrado"); } catch { ok(true, "não dá para criar rodada de evento encerrado"); }
// Conversas depois da revelação
const lance = async (f: () => Promise<unknown>) => { try { await f(); return "ok"; } catch (e) { return (e as { code?: string }).code ?? "erro"; } };
const estranho = randomUUID();
await adm.query(`INSERT INTO "User"(id,"updatedAt") VALUES ($1,now())`, [estranho]);
ok((await lance(() => svc.conversa(codigo, null, null))) === "FORBIDDEN", "quem não participou da conversa não pode nem abrir o fio");
ok((await lance(() => svc.conversa(codigo, null, estranho))) === "FORBIDDEN", "outra pessoa com conta também não");
ok((await lance(() => svc.agirNaConversa(r4.codigo, { acao: "propor" }, null, fabio))) === "AGE_REQUIRED", "quem tem conta precisa confirmar 16+ e os Termos antes de conversar");
ok((await svc.conversa(codigo, null, fabio)).precisaIdade === true && (await svc.conversa(codigo, p.token, null)).precisaIdade === false, "só quem tem conta e ainda não confirmou é avisado; o convidado já confirmou ao opinar");
ok((await lance(() => svc.agirNaConversa(codigo, { acao: "confirmar_idade", consentimentoIdade: { aceito: true, versao: "outra", hash: "x" } }, null, fabio))) === "erro", "a confirmação precisa ser a versão certa do aviso");
await svc.agirNaConversa(codigo, { acao: "confirmar_idade", consentimentoIdade: idade }, null, fabio);
ok((await svc.conversa(codigo, null, fabio)).precisaIdade === false, "depois de confirmar uma vez, não pergunta de novo");
ok((await lance(() => svc.agirNaConversa(r4.codigo, { acao: "propor" }, null, fabio))) === "CONFLICT", "sem as duas opiniões (evento sem comparação) não dá para propor conversa");
ok((await lance(() => svc.agirNaConversa(r3.codigo, { acao: "propor" }, null, fabio))) === "CONFLICT", "evento cancelado: não dá para propor conversa");
const c0 = await svc.conversa(codigo, p.token, null);
ok(c0.liberada && c0.status === null && c0.outra === "Fabio", "revelada: a conversa está liberada, ainda sem fio");
ok((await lance(() => svc.agirNaConversa(codigo, { acao: "enviar", texto: "oi" }, p.token, null))) === "NOT_FOUND", "não dá para mandar mensagem antes de existir uma conversa aceita");
await svc.agirNaConversa(codigo, { acao: "propor" }, p.token, null);
ok((await lance(() => svc.agirNaConversa(codigo, { acao: "propor" }, null, fabio))) === "CONFLICT", "só uma conversa por rodada");
ok((await lance(() => svc.agirNaConversa(codigo, { acao: "enviar", texto: "oi" }, p.token, null))) === "CONFLICT", "enquanto o primeiro contato não é aceito, ninguém escreve");
ok((await lance(() => svc.agirNaConversa(codigo, { acao: "aceitar" }, p.token, null))) === "CONFLICT", "quem propôs não pode aceitar a própria proposta");
const avisoProposta = await adm.query(`SELECT 1 FROM "Notification" WHERE "recipientId"=$1 AND "eventType"='MUNDO_CONVERSA_PROPOSTA'`, [fabio]);
ok((avisoProposta.rowCount ?? 0) === 1, "Fabio recebe um aviso de que a Marina quer conversar");
const cMarina = await svc.conversa(codigo, p.token, null), cFabio = await svc.conversa(codigo, null, fabio);
ok(cMarina.proposta === "voce" && cFabio.proposta === "outra" && cFabio.mensagens.length === 0, "cada lado vê de quem é a vez de responder à proposta");
await svc.agirNaConversa(codigo, { acao: "aceitar" }, null, fabio);
await svc.agirNaConversa(codigo, { acao: "enviar", texto: "Eu também achei que seria o Palmeiras. E você?" }, p.token, null);
await svc.agirNaConversa(codigo, { acao: "enviar", texto: "Uma segunda mensagem seguida da Marina." }, p.token, null);
await svc.agirNaConversa(codigo, { acao: "enviar", texto: "Achei até o fim, mas nem tanto." }, null, fabio);
const fio = await svc.conversa(codigo, null, fabio);
ok(fio.status === "ACCEPTED" && fio.mensagens.length === 3 && fio.mensagens[0]!.minha === false && fio.mensagens[2]!.minha === true, "depois de aceita, as mensagens aparecem na ordem certa e cada lado sabe quais são suas");
const avisosMsg = await adm.query(`SELECT 1 FROM "Notification" WHERE "recipientId"=$1 AND "eventType"='MUNDO_CONVERSA_MENSAGEM'`, [fabio]);
ok((avisosMsg.rowCount ?? 0) === 1, "o aviso de mensagem só toca quando a vez muda de mãos (2 mensagens seguidas = 1 aviso)");
ok(!JSON.stringify(await adm.query(`SELECT * FROM "Notification" WHERE "recipientId"=$1`, [fabio]).then((r) => r.rows)).includes("segunda mensagem"), "o texto das mensagens nunca vai para a notificação");
ok((await lance(() => svc.agirNaConversa(codigo, { acao: "enviar", texto: "x".repeat(1001) }, null, fabio))) === "erro", "mensagem acima de 1000 caracteres é recusada");
ok((await lance(() => svc.agirNaConversa(codigo, { acao: "enviar", texto: "   " }, null, fabio))) === "erro", "mensagem vazia é recusada");
ok((await lance(() => svc.agirNaConversa(codigo, { acao: "enviar", texto: "invasor" }, null, estranho))) === "FORBIDDEN", "quem não faz parte não consegue escrever");
await svc.agirNaConversa(codigo, { acao: "denunciar", motivo: "Mensagem incômoda." }, p.token, null);
const doFio = `(SELECT t.id FROM "RoundThread" t JOIN "WorldRound" w ON w.id=t."roundId" WHERE w.code=$1)`;
ok(Number((await adm.query(`SELECT count(*) AS n FROM "RoundThreadReport" WHERE "threadId"=${doFio}`, [codigo])).rows[0].n) === 1, "denúncia da conversa fica registrada para revisão manual");
await svc.agirNaConversa(codigo, { acao: "encerrar" }, null, fabio);
ok((await lance(() => svc.agirNaConversa(codigo, { acao: "enviar", texto: "ainda aqui?" }, p.token, null))) === "CONFLICT", "depois de encerrada, ninguém mais escreve");
ok((await svc.conversa(codigo, p.token, null)).status === "CLOSED", "o outro lado vê que a conversa foi encerrada");
// retenção: mensagens com mais de 90 dias somem no job diário
await adm.query(`UPDATE "RoundMessage" SET "createdAt"=clock_timestamp()-interval '91 days' WHERE body LIKE 'Eu também%'`);
await adm.query(`DELETE FROM "RoundMessage" WHERE "createdAt" < clock_timestamp() - interval '90 days'`);
ok(Number((await adm.query(`SELECT count(*) AS n FROM "RoundMessage" WHERE "threadId"=${doFio}`, [codigo])).rows[0].n) === 2, "a retenção de 90 dias apaga só as mensagens antigas");
// Recusa: a pessoa convidada diz não à proposta, e a conversa acaba ali
const debate = await evento("Teste de recusa", 60 * 24);
const r5 = await svc.criar({ eventoId: debate.id, modo: "prever", nome: "Fabio" }, fabio);
const bia2 = await svc.participar(r5.codigo, { nome: "Bia2", opcao: debate.sim, consentimentoIdade: idade }, null, null);
await svc.opinar(r5.codigo, { opcao: debate.sim }, fabio);
await adm.query(`UPDATE "WorldEvent" SET "closesAt"=clock_timestamp()-interval '1 minute' WHERE id=$1`, [debate.id]);
await svc.agirNaConversa(r5.codigo, { acao: "propor" }, null, fabio); // Fabio já confirmou a idade: vale para todas as conversas dele
ok((await lance(() => svc.agirNaConversa(r5.codigo, { acao: "recusar" }, null, fabio))) === "CONFLICT", "quem propôs não pode recusar a própria proposta");
await svc.agirNaConversa(r5.codigo, { acao: "recusar" }, bia2.token, null);
ok((await svc.conversa(r5.codigo, null, fabio)).status === "DECLINED", "proposta recusada fica como recusada");
ok((await lance(() => svc.agirNaConversa(r5.codigo, { acao: "enviar", texto: "mesmo assim" }, null, fabio))) === "CONFLICT", "depois de recusada, ninguém escreve");
ok((await lance(() => svc.agirNaConversa(r5.codigo, { acao: "propor" }, null, fabio))) === "CONFLICT", "e não dá para propor de novo na mesma rodada");

// Minhas conexões: simétrico, sem pontuação
const cx = await svc.conexoes(fabio, null);
const marina = cx.pessoas.find((x) => x.nome === "Marina")!, bia = cx.pessoas.find((x) => x.nome === "Bia")!;
ok(marina.igual === 1 && marina.diferente === 0 && marina.porCategoria.esporte?.iguais === 1, "conexões: Fabio e Marina pensaram igual em 1 assunto, de Esporte");
ok(bia.semOpiniao === 1 && bia.igual === 0 && bia.diferente === 0, "conexões: 'prefiro não opinar' não conta como igual nem como diferente");
ok(cx.resumo.pensaramIgual === 2 && cx.resumo.pendentes === 0, "resumo: 2 vezes em que pensaram igual (Marina e Bia2); canceladas e sem comparação não ficam em aberto");
ok(!JSON.stringify(cx).includes(fabio), "as conexões não expõem identificadores internos");
ok(!["acertos", "erros", "aproveitamento", "sequencia"].some((k) => JSON.stringify(cx).includes(k)), "não existe pontuação, aproveitamento nem sequência");

await pool.end(); await adm.end();
console.log("TODOS OS TESTES PASSARAM");
