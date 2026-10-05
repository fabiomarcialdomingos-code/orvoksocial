// Testa o convite para o retrato (sem cadastro, sem pontuação) contra um banco migrado.
// Uso: AUTH_SECRET=... AUTH_DATABASE_URL=(papel orvok_auth_runtime) DATABASE_URL=(dono) pnpm test:desafio
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { DesafioService } from "@/lib/desafio/service";
import { AVISO_HASH, AVISO_IDADE_HASH, AVISO_IDADE_VERSAO, AVISO_VERSAO } from "@/lib/desafio/catalogo";
import { NUCLEO, ORDEM_TRACOS } from "@/lib/desafio/nucleo";
import { notas, perfil, selo } from "@/lib/desafio/perfil";
import { escolherRetrato } from "@/lib/desafio/selecao";

const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
const adm = new Pool({ connectionString: process.env.DATABASE_URL });
const svc = new DesafioService(pool);
const ok = (c: boolean, m: string) => { if (!c) { console.error("FALHOU:", m); process.exit(1); } console.log("ok -", m); };
const L = ["A", "B", "C", "D"] as const;

// Núcleo
ok(NUCLEO.length === 156 && new Set(NUCLEO.map((p) => p.chave)).size === 156, "núcleo com 156 perguntas únicas");
ok(ORDEM_TRACOS.every((t) => NUCLEO.filter((p) => p.traco === t).length === 26), "26 perguntas por traço (20 gerais + 2 por relação)");
ok(NUCLEO.every((p) => p.pesos.some((w) => w > 0) && p.pesos.some((w) => w < 0)), "toda pergunta tem opções para os dois lados do traço");

// Seleção: as 12 perguntas do retrato
for (let i = 0; i < 300; i++) {
  const rel = (["familia", "amigos", "crush"] as const)[i % 3]!;
  const rt = escolherRetrato(rel, new Map());
  const porTraco = ORDEM_TRACOS.map((t) => rt.filter((p) => p.traco === t).length);
  if (rt.length !== 12 || new Set(rt.map((p) => p.chave)).size !== 12 || porTraco.some((n) => n !== 2) || rt.some((p) => p.contexto && p.contexto !== rel)) ok(false, "retrato: 12 perguntas, 2 por traço, relação certa");
}
ok(true, "300 sorteios: sempre 12 perguntas, 2 por traço, da relação certa");
const todos = escolherRetrato("amigos", new Map());

// Perfil e selo
const positivo = notas(todos.map((p) => p.chave), todos.map((p) => p.pesos.indexOf(2)));
ok(ORDEM_TRACOS.every((t) => positivo[t] === 1) && perfil(positivo).nome === "O Líder", "respostas no primeiro polo dão O Líder, com 100% em cada traço");
const negativo = notas(todos.map((p) => p.chave), todos.map((p) => p.pesos.indexOf(-2)));
ok(perfil(negativo).nome === "O Sonhador" && perfil(negativo).marcantes.join() === "Intenso,Caseiro,Cuidador", "respostas no segundo polo dão O Sonhador: Intenso, Caseiro, Cuidador");
ok(selo(positivo, positivo).nivel === "autentico" && selo(positivo, negativo).nivel === null, "selo autêntico quando os 6 traços batem");

// Serviço: convite para o retrato (12 perguntas, quem responde compartilha a sua visão, anônimo)
const conjunto = todos.map((p) => p.chave);
const respostas = todos.map((p) => L[p.pesos.indexOf(2)]!);
const consent = { aceito: true, versao: AVISO_VERSAO, hash: AVISO_HASH };
const consentIdade = { aceito: true as const, versao: AVISO_IDADE_VERSAO, hash: AVISO_IDADE_HASH };
const avisoRetrato = "retrato-opiniao-v1" as const;
ok(svc.diagnostico({ perguntas: conjunto, respostas }).nome === "O Líder", "diagnóstico do retrato logo após as 12 perguntas");
const { codigo, token: dono } = await svc.criar({ nome: "Caio", relacao: "amigos", perguntas: conjunto, respostas, consentimento: consent }, null);
ok(/^[A-HJ-NP-Z2-9]{8}$/.test(codigo), `convite criado (${codigo})`);
const v = await svc.vitrine(codigo, null);
ok(v.perguntas.length === 12 && !("answers" in v) && !v.jaRespondeu && v.avisoIdade.versao === AVISO_IDADE_VERSAO, "vitrine do convite: 12 perguntas, sem respostas, com aviso de idade");
try { await svc.tentar(codigo, { nome: "Sem idade", previsoes: respostas, avisoRetrato }, null); ok(false, "sem idade"); } catch { ok(true, "resposta sem confirmar 16 anos é recusada"); }
try { await svc.tentar(codigo, { nome: "Sem aviso", previsoes: respostas, consentimentoIdade: consentIdade }, null); ok(false, "sem aviso"); } catch { ok(true, "quem responde precisa aceitar o aviso de anonimato"); }
// Opiniões: todos enxergam o Caio do jeito oposto ao que ele se vê.
const opostas = todos.map((p) => L[p.pesos.indexOf(-2)]!);
const op1 = await svc.tentar(codigo, { nome: "Leo", previsoes: opostas, avisoRetrato, consentimentoIdade: consentIdade }, null);
ok(op1.miniResultado.poucosDados, "1ª visão: poucos dados ainda para comparar");
const op2 = await svc.tentar(codigo, { nome: "Bia", previsoes: opostas, avisoRetrato, consentimentoIdade: consentIdade }, null);
ok(op2.miniResultado.poucosDados, "2ª visão: ainda poucos dados (só 1 outra pessoa)");
const dois = await svc.retrato(dono, null);
ok(dois.eu?.nome === "O Líder" && dois.eles === null && dois.faltam === 1, "com 2 opiniões: você se vê, mas o 'como te veem' ainda não aparece");
const r3 = await svc.tentar(codigo, { nome: "Rui", previsoes: opostas, avisoRetrato, consentimentoIdade: consentIdade }, null);
ok(!("score" in r3) && typeof r3.token === "string", "não existe pontuação: a resposta só devolve o token do aparelho e o mini-resultado");
ok(!r3.miniResultado.poucosDados && r3.miniResultado.bateram === r3.miniResultado.deTotal, "3ª visão: com 2 outras já dá para comparar, e bateu em tudo (todos viram igual)");
const tres = await svc.retrato(dono, null);
ok(tres.eles?.nome === "O Sonhador" && tres.selo?.nivel === null && tres.respondentes === 3, "com 3 opiniões: te veem como O Sonhador (o oposto) e sem selo");
// Oculto: traço marcado é privado, não entra no selo, e some quando desmarcado.
await svc.marcarOculto({ traco: "reacao", oculto: true }, dono, null);
const comOculto = await svc.retrato(dono, null);
ok(comOculto.ocultos.includes("reacao") && comOculto.selo?.batem === tres.selo?.batem, "marcar 'reação' como oculto não muda o selo nem a comparação");
ok(comOculto.apareceram.includes("reacao") === (((comOculto.eu!.tracos.find((t) => t.traco === "reacao")!.polo) === (comOculto.eles!.tracos.find((t) => t.traco === "reacao")!.polo))), "'apareceram' só lista o traço oculto quando ele bate com a média de quem respondeu");
await svc.marcarOculto({ traco: "reacao", oculto: false }, dono, null);
ok((await svc.retrato(dono, null)).ocultos.length === 0, "desmarcar o oculto remove da lista");
try { await svc.marcarOculto({ traco: "reacao", oculto: true }, null, null); ok(false, "oculto sem identidade"); } catch (e) { ok((e as { code?: string }).code === "FORBIDDEN", "sem token nem conta, não dá para marcar oculto"); }

// Linha do tempo: só grava um marco novo quando o selo realmente muda.
const linha1 = await svc.linhaDoTempo(dono, null);
ok(linha1.length === 1 && linha1[0]!.nivel === null, "a 3ª opinião (sem selo) já grava o 1º marco da linha do tempo");
await svc.tentar(codigo, { nome: "Duda", previsoes: opostas, avisoRetrato, consentimentoIdade: consentIdade }, null);
ok((await svc.linhaDoTempo(dono, null)).length === 1, "4ª opinião igual às outras: selo não muda, não grava marco novo");
await svc.tentar(codigo, { nome: "Zeca", previsoes: respostas, avisoRetrato, consentimentoIdade: consentIdade }, null);
await svc.tentar(codigo, { nome: "Tom", previsoes: respostas, avisoRetrato, consentimentoIdade: consentIdade }, null);
await svc.tentar(codigo, { nome: "Lia2", previsoes: respostas, avisoRetrato, consentimentoIdade: consentIdade }, null);
await svc.tentar(codigo, { nome: "Pedro", previsoes: respostas, avisoRetrato, consentimentoIdade: consentIdade }, null);
const linha2 = await svc.linhaDoTempo(dono, null);
ok(linha2.length === 2 && linha2[1]!.nivel === "autentico" && linha2[1]!.batem === 6, "quando o selo muda de verdade (virou nítido), grava um 2º marco");
ok(new Date(linha2[0]!.em).getTime() <= new Date(linha2[1]!.em).getTime(), "os marcos vêm em ordem cronológica");

const meus = await svc.meus(dono, null);
ok(meus.desafios[0]!.tentativas.length === 8 && meus.desafios[0]!.tentativas.every((t) => Object.keys(t).join() === "em"), "na lista do dono, cada visão é anônima: só a data, sem nome nem pontuação");
const recebidosAna = await svc.recebidos(op1.token, null);
ok(recebidosAna.length === 1 && recebidosAna[0]!.nome === "Caio" && !("acertos" in recebidosAna[0]!), "quem respondeu vê sobre quem compartilhou a visão, sem pontuação");
const jaViu = await svc.vitrine(codigo, op1.token);
ok(jaViu.jaRespondeu, "quem já respondeu volta e vê que já respondeu");
try { await svc.criar({ nome: "X", relacao: "amigos", perguntas: conjunto.slice(0, 5), respostas: respostas.slice(0, 5), consentimento: consent }, null); ok(false, "5 perguntas"); } catch { ok(true, "convite com menos de 12 perguntas é recusado"); }

const userId = randomUUID();
await adm.query(`INSERT INTO "User"(id,"updatedAt") VALUES ($1,now())`, [userId]);
ok((await svc.reivindicar(dono, userId)) === 1 && (await svc.retrato(null, userId)).respondentes === 8, "o retrato acompanha a conta depois do cadastro");
ok((await svc.linhaDoTempo(null, userId)).length === 2, "a linha do tempo também acompanha a conta depois do cadastro");

// Denúncia e bloqueio
const { codigo: codigo2, token: dono2 } = await svc.criar({ nome: "Marina", relacao: "amigos", perguntas: conjunto, respostas, consentimento: consent }, null);
const denuncia = await svc.denunciar(codigo2, { motivo: "Mensagem incômoda junto do link." }, null, null);
ok(denuncia.nome === "Marina" && typeof denuncia.token === "string", "denúncia registrada e devolve um token de aparelho");
const { token: bloqueador } = await svc.bloquear(codigo2, null, null);
try { await svc.vitrine(codigo2, bloqueador, null); ok(false, "bloqueado ainda vê a vitrine"); } catch (e) { ok((e as { code?: string }).code === "BLOCKED", "quem bloqueou não abre mais o convite dessa pessoa"); }
try { await svc.tentar(codigo2, { nome: "Bloqueado", previsoes: respostas, avisoRetrato, consentimentoIdade: consentIdade }, bloqueador); ok(false, "bloqueado ainda responde"); } catch (e) { ok((e as { code?: string }).code === "BLOCKED", "quem bloqueou também não consegue responder sobre essa pessoa"); }
const outraPessoa = await svc.vitrine(codigo2, null, null);
ok(outraPessoa.nome === "Marina", "o bloqueio não afeta quem mais recebeu o mesmo link");
try { await svc.bloquear(codigo2, dono2, null); ok(false, "dono bloqueia a si mesmo"); } catch (e) { ok((e as { code?: string }).code === "OWN_CHALLENGE", "quem criou o convite não pode bloquear a si mesmo"); }

await svc.cancelar(codigo, dono, null);
try { await svc.vitrine(codigo, null); ok(false, "cancelado"); } catch (e) { ok((e as { status?: number }).status === 404, "convite cancelado para de funcionar"); }
await pool.end(); await adm.end();
console.log("TODOS OS TESTES PASSARAM");
