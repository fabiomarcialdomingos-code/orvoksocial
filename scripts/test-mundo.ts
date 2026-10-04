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
// Minhas conexões: simétrico, sem pontuação
const cx = await svc.conexoes(fabio, null);
const marina = cx.pessoas.find((x) => x.nome === "Marina")!, bia = cx.pessoas.find((x) => x.nome === "Bia")!;
ok(marina.igual === 1 && marina.diferente === 0 && marina.porCategoria.esporte?.iguais === 1, "conexões: Fabio e Marina pensaram igual em 1 assunto, de Esporte");
ok(bia.semOpiniao === 1 && bia.igual === 0 && bia.diferente === 0, "conexões: 'prefiro não opinar' não conta como igual nem como diferente");
ok(cx.resumo.pensaramIgual === 1 && cx.resumo.pendentes === 0, "resumo: 1 vez em que pensaram igual; canceladas e sem comparação não ficam em aberto");
ok(!JSON.stringify(cx).includes(fabio), "as conexões não expõem identificadores internos");
ok(!["acertos", "erros", "aproveitamento", "sequencia"].some((k) => JSON.stringify(cx).includes(k)), "não existe pontuação, aproveitamento nem sequência");

await pool.end(); await adm.end();
console.log("TODOS OS TESTES PASSARAM");
