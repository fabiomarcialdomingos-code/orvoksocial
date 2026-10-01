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

// Quero ser previsto
const { codigo } = await svc.criar({ eventoId: jogo.id, modo: "ser_previsto", resposta: jogo.sim, nome: "Fabio" }, fabio);
const v1 = await svc.verComoConvidado(codigo, null);
ok(v1.minhaVez && v1.revelacao === null && v1.minhaResposta === null, "convidado vê a pergunta, mas não a resposta do Fabio");
const p = await svc.participar(codigo, { nome: "Marina", opcao: jogo.sim, consentimentoIdade: idade }, null, null);
ok(p.estado === "aguardando_revelacao" && p.revelacao === null && p.meuPalpite === "Sim", "palpite registrado e nada revelado antes do evento");
try { await svc.participar(codigo, { nome: "Outra", opcao: jogo.nao, consentimentoIdade: idade }, null, null); ok(false, "segunda pessoa"); } catch { ok(true, "a rodada fica com o primeiro aparelho que respondeu"); }
const lista = await svc.minhas(fabio, null);
ok(lista[0]!.estado === "aguardando_revelacao" && lista[0]!.revelacao === null && lista[0]!.minhaResposta === "Sim", "Fabio vê a própria resposta, mas não o palpite da Marina");
await adm.query(`UPDATE "WorldEvent" SET "closesAt"=now()-interval '1 minute' WHERE id=$1`, [jogo.id]);
const rev = await svc.verComoConvidado(codigo, p.token);
ok(rev.estado === "revelada" && rev.revelacao?.acertou === true && rev.revelacao.resposta === "Sim", "depois do evento: Marina acertou o que Fabio respondeu");

// Quero prever alguém + "não sei"
const filme = await evento("O filme vai ganhar o Oscar?", 60 * 24);
const r2 = await svc.criar({ eventoId: filme.id, modo: "prever", nome: "Fabio" }, fabio);
const g = await svc.participar(r2.codigo, { nome: "Bia", opcao: filme.nao, consentimentoIdade: idade }, null, null);
ok(g.estado === "aguardando_palpite" && g.minhaResposta === "Não", "Bia respondeu a própria opinião; agora é a vez do Fabio");
try { await svc.participar(r2.codigo, { nome: "Bia", opcao: null, consentimentoIdade: idade }, g.token, null); ok(false, "nao sei como opiniao"); } catch { ok(true, "a própria opinião não pode ser 'não sei' nem ser trocada"); }
const pal = await svc.palpitar(r2.codigo, { opcao: null }, fabio);
ok(pal.estado === "aguardando_revelacao", "Fabio escolheu 'não sei'");
await adm.query(`UPDATE "WorldEvent" SET "closesAt"=now()-interval '1 minute' WHERE id=$1`, [filme.id]);
const rev2 = (await svc.minhas(fabio, null)).find((x) => x.codigo === r2.codigo)!;
ok(rev2.revelacao?.naoSei === true && rev2.revelacao.acertou === false && rev2.revelacao.resposta === "Não", "'não sei' aparece separado, sem contar como acerto");

// Evento cancelado e evento que terminou sem os dois responderem
const cancelado = await evento("Evento cancelado", 60 * 24);
const r3 = await svc.criar({ eventoId: cancelado.id, modo: "ser_previsto", resposta: cancelado.sim, nome: "Fabio" }, fabio);
await adm.query(`UPDATE "WorldEvent" SET status='CANCELLED' WHERE id=$1`, [cancelado.id]);
ok((await svc.minhas(fabio, null)).find((x) => x.codigo === r3.codigo)?.estado === "cancelada", "evento cancelado: a rodada não conta");
const vazio = await evento("Ninguém respondeu", 60 * 24);
const r4 = await svc.criar({ eventoId: vazio.id, modo: "ser_previsto", resposta: vazio.sim, nome: "Fabio" }, fabio);
await adm.query(`UPDATE "WorldEvent" SET "closesAt"=now()-interval '1 minute' WHERE id=$1`, [vazio.id]);
ok((await svc.minhas(fabio, null)).find((x) => x.codigo === r4.codigo)?.estado === "sem_comparacao", "terminou sem palpite: sem comparação, não é erro de ninguém");
try { await svc.criar({ eventoId: vazio.id, modo: "prever", nome: "Fabio" }, fabio); ok(false, "evento encerrado"); } catch { ok(true, "não dá para criar rodada de evento encerrado"); }
// Meu placar
const pl = await svc.placar(fabio, null);
const marina = pl.pessoas.find((x) => x.nome === "Marina")!, bia = pl.pessoas.find((x) => x.nome === "Bia")!;
ok(marina.sobreVoce.acertos === 1 && marina.voceSobre.acertos === 0 && marina.porCategoria.esporte?.acertos === 1, "placar: Marina acertou 1 sobre o Fabio, em Esporte");
ok(bia.voceSobre.naoSei === 1 && bia.voceSobre.acertos === 0 && bia.sobreVoce.acertos === 0, "placar: o 'não sei' do Fabio sobre a Bia fica como abstenção, na direção certa");
ok(pl.resumo.acertosSobreVoce === 1 && pl.resumo.pendentes === 0, "resumo: 1 acerto sobre você; rodadas canceladas e sem comparação não ficam pendentes");
ok(!JSON.stringify(pl).includes(fabio), "o placar não expõe identificadores internos");
const passos = Number((await adm.query(`SELECT count(*) FROM "ProductEvent" WHERE name LIKE 'mundo_%'`)).rows[0].count);
ok(passos >= 6, `medição registrou os passos do Mundo (${passos})`);

await pool.end(); await adm.end();
console.log("TODOS OS TESTES PASSARAM");
