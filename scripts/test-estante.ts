// Testa a Estante: pessoas, círculo, lembranças, presentes, reação, comparação, visitas, bloqueio e privacidade.
// Uso: AUTH_SECRET=... AUTH_DATABASE_URL=(orvok_auth_runtime) DATABASE_URL=(dono) npx tsx scripts/test-estante.ts
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { AVISO_IDADE_HASH, AVISO_IDADE_VERSAO } from "@/lib/desafio/catalogo";
import { EstanteService, comparar } from "@/lib/estante/service";

const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
const adm = new Pool({ connectionString: process.env.DATABASE_URL });
const svc = new EstanteService(pool);
const ok = (c: boolean, m: string) => { if (!c) { console.error("FALHOU:", m); process.exit(1); } console.log("ok -", m); };
const erro = async (f: () => Promise<unknown>) => { try { await f(); return "ok"; } catch (e) { return (e as { code?: string }).code ?? (e as Error).name; } };
const idade = { aceito: true as const, versao: AVISO_IDADE_VERSAO, hash: AVISO_IDADE_HASH };
const novoUsuario = async () => { const id = randomUUID(); await adm.query(`INSERT INTO "User"(id,"updatedAt") VALUES ($1,now())`, [id]); return id; };
const tok = () => randomUUID() + randomUUID();

// interruptor
ok((await svc.ativa()) === false, "a Estante nasce desligada");
await svc.ligar(true); ok((await svc.ativa()) === true, "dá para ligar");
await svc.ligar(false); ok((await svc.ativa()) === false, "e desligar de novo");

// pessoas
const ana = { token: null, userId: await novoUsuario() }, bia = { token: tok(), userId: null }, caio = { token: tok(), userId: null };
ok((await svc.achar(ana)) === null, "quem nunca participou não tem pessoa");
ok((await erro(() => svc.garantir(ana, { nome: "Ana" }))) === "ZodError", "para entrar é preciso confirmar 16+ e os Termos");
ok((await erro(() => svc.garantir(ana, { nome: "<b>Ana</b>", consentimentoIdade: idade }))) === "ZodError", "nome com caracteres perigosos é recusado");
const pAna = await svc.garantir(ana, { nome: "Ana", consentimentoIdade: idade });
ok(pAna.nome === "Ana" && pAna.idadeOk && pAna.inviteCode.length === 8, "cria a pessoa com código de convite");
ok((await svc.garantir(ana, {})).id === pAna.id, "chamar de novo devolve a mesma pessoa");
const pBia = await svc.garantir(bia, { nome: "Bia", consentimentoIdade: idade });
await svc.garantir(caio, { nome: "Caio", consentimentoIdade: idade });

// círculo
ok((await erro(() => svc.entrarPeloConvite("XXXXXXXX", bia, {}))) === "NOT_FOUND", "convite inexistente");
ok((await erro(() => svc.entrarPeloConvite(pAna.inviteCode, ana, {}))) === "CONFLICT", "ninguém entra no próprio círculo");
await svc.entrarPeloConvite(pAna.inviteCode, bia, {});
ok((await svc.circulo(ana)).pessoas.map((p) => p.nome).join() === "Bia" && (await svc.circulo(bia)).pessoas.map((p) => p.nome).join() === "Ana", "o círculo vale para os dois lados");
await svc.entrarPeloConvite(pAna.inviteCode, bia, {});
ok((await svc.circulo(ana)).pessoas.length === 1, "entrar duas vezes não duplica");

// lembranças diretas
const base = { titulo: "Violão", frase: "Ouvi aquela música e lembrei de você.", previsao: 3 };
ok((await erro(() => svc.enviar(caio, { ...base, paraPessoaId: pAna.id }))) === "FORBIDDEN", "só dá para mandar a quem é do círculo");
ok((await erro(() => svc.enviar(bia, { ...base, paraPessoaId: pAna.id, paraNome: "Outra" }))) === "ZodError", "ou é alguém do círculo ou é um presente, não os dois");
ok((await erro(() => svc.enviar(bia, { ...base, paraPessoaId: pAna.id, previsao: 7 }))) === "ZodError", "a previsão vai de 1 a 5");
ok((await erro(() => svc.enviar(bia, { ...base, paraPessoaId: pBia.id }))) === "CONFLICT", "não dá para mandar para si mesmo");
const l1 = await svc.enviar(bia, { ...base, paraPessoaId: pAna.id });
ok(l1.tipo === "direta", "lembrança direta entra na estante de quem recebeu");
const nots = await adm.query(`SELECT 1 FROM "Notification" WHERE "recipientId"=$1 AND "eventType"='ESTANTE_LEMBRANCA'`, [ana.userId]);
ok(nots.rowCount === 1, "quem tem conta recebe um aviso");
ok(!JSON.stringify((await adm.query(`SELECT * FROM "Notification" WHERE "recipientId"=$1`, [ana.userId])).rows).includes("aquela música"), "a frase nunca vai para a notificação");
for (let i = 0; i < 3; i++) await svc.enviar(bia, { ...base, titulo: `Objeto ${i}`, paraPessoaId: pAna.id });
ok((await erro(() => svc.enviar(bia, { ...base, paraPessoaId: pAna.id }))) === "RATE_LIMITED", "no máximo 4 lembranças por dia para a mesma pessoa");

// reação e comparação
const est = await svc.minhaEstante(ana);
ok(est!.objetos.length === 4 && est!.objetos.every((o) => o.de === "Bia"), "a estante da Ana mostra o que Bia deu");
ok((await erro(() => svc.reagir(bia, l1.id, 5))) === "CONFLICT", "quem mandou não pode reagir à própria lembrança");
ok((await erro(() => svc.reagir(ana, l1.id, 9))) === "ZodError", "a reação vai de 1 a 5");
const rea = await svc.reagir(ana, l1.id, 5);
ok(rea.previsto === 3 && rea.reacao === 5 && rea.diferenca === 2 && rea.frase.startsWith("Gostaram mais"), "a comparação mostra que gostaram mais do que se imaginava");
ok((await erro(() => svc.reagir(ana, l1.id, 4))) === "CONFLICT", "a reação vale uma vez");
const env = await svc.enviadas(bia);
const dessa = env.find((e) => e.id === l1.id)!;
ok(dessa.previsto === 3 && dessa.reacao === 5 && (dessa.frase?.startsWith("Gostaram mais") ?? false), "quem mandou vê a diferença entre o que previu e a reação");
ok(comparar(4, 4).frase.startsWith("Foi do jeito") && comparar(5, 2).frase.includes("menos entusiasmo"), "a comparação é honesta quando a reação é igual ou menor");
ok((await adm.query(`SELECT 1 FROM "Notification" WHERE "recipientId"=$1 AND "eventType"='ESTANTE_REACAO'`, [ana.userId])).rowCount === 0, "quem mandou sem conta não recebe aviso (só quem tem conta)");

// presentes para quem ainda não está no orvok
const pres = await svc.enviar(ana, { titulo: "Farol", frase: "Lembrei do seu jeito de guiar a turma.", previsao: 2, paraNome: "Dani" });
ok(pres.tipo === "presente" && pres.codigo.length === 8, "para quem está fora vira um presente com link");
const previa = await svc.verPresente(pres.codigo);
ok(previa.objeto === "Farol" && previa.de === "Ana" && !JSON.stringify(previa).includes("guiar a turma"), "o link mostra o objeto e quem deu, nunca a frase");
const dani = { token: tok(), userId: null };
ok((await erro(() => svc.abrirPresente(pres.codigo, dani, {}))) === "ZodError", "para abrir é preciso informar o nome e confirmar 16+");
ok((await erro(() => svc.abrirPresente(pres.codigo, ana, {}))) === "CONFLICT", "quem deu não abre o próprio presente");
const aberto = await svc.abrirPresente(pres.codigo, dani, { nome: "Dani", consentimentoIdade: idade });
ok((aberto.frase?.includes("guiar a turma") ?? false) && aberto.de === "Ana", "quem abre vê a frase");
ok((await svc.circulo(ana)).pessoas.some((p) => p.nome === "Dani"), "abrir o presente cria o vínculo");
ok((await erro(() => svc.abrirPresente(pres.codigo, { token: tok(), userId: null }, { nome: "Outro", consentimentoIdade: idade }))) === "CONFLICT", "o presente é de quem abriu primeiro");
ok((await svc.abrirPresente(pres.codigo, dani, {})).id === aberto.id, "o dono pode reabrir quantas vezes quiser");
ok((await svc.enviadas(ana)).find((e) => e.codigo === pres.codigo)!.aberta === true, "quem deu vê que foi aberto");
ok((await adm.query(`SELECT 1 FROM "Notification" WHERE "recipientId"=$1 AND "eventType"='ESTANTE_PRESENTE_ABERTO'`, [ana.userId])).rowCount === 1, "e recebe um aviso, se tiver conta");

// visitas e privacidade da frase
const pDani = (await svc.achar(dani))!;
await svc.entrarPeloConvite(pBia.inviteCode, dani, {});
const visao = await svc.estanteDe(dani, pAna.id);
ok(visao.objetos.length === 4 && visao.objetos.every((o) => o.frase === null), "quem visita vê os objetos, nunca as frases");
ok(!JSON.stringify(visao).includes("aquela música"), "nenhuma frase vaza para o visitante");
const visaoBia = await svc.estanteDe(bia, pAna.id);
ok(visaoBia.objetos.filter((o) => o.frase !== null).length === 4, "quem escreveu a frase a vê na estante de quem recebeu");
ok((await erro(() => svc.estanteDe(caio, pAna.id))) === "FORBIDDEN", "quem não é do círculo não visita a estante");
let semana = (await svc.minhaEstante(ana))!.visitas;
ok(semana.naSemana === 2 && semana.passaramPorAqui.length === 0, "visitas passivas viram contagem, sem nome");
await svc.marcar(dani, pAna.id);
await svc.marcar(dani, pAna.id);
semana = (await svc.minhaEstante(ana))!.visitas;
ok(semana.passaramPorAqui.map((m) => m.nome).join() === "Dani", "só quem deixa o 'passei por aqui' aparece com nome");
ok((await adm.query(`SELECT 1 FROM "Notification" WHERE "recipientId"=$1 AND "eventType"='ESTANTE_PEGADA'`, [ana.userId])).rowCount === 1, "marcar duas vezes no dia avisa uma vez só");

// esconder, recolher e bloquear
await svc.ocultar(ana, est!.objetos[3]!.id);
ok((await svc.minhaEstante(ana))!.objetos.length === 3, "quem recebeu pode esconder um objeto");
const l5 = await svc.enviar(dani, { titulo: "Livro", previsao: 4, paraPessoaId: pAna.id });
ok((await erro(() => svc.recolher(ana, l5.id))) === "NOT_FOUND", "só quem mandou recolhe");
await svc.recolher(dani, l5.id);
ok((await erro(() => svc.reagir(ana, l5.id, 3))) === "CONFLICT", "lembrança recolhida não aceita reação");
await svc.bloquear(ana, pBia.id);
ok((await svc.minhaEstante(ana))!.objetos.every((o) => o.de !== "Bia"), "bloquear tira da estante o que a pessoa bloqueada deu");
ok((await erro(() => svc.enviar(bia, { ...base, titulo: "Novo", paraPessoaId: pAna.id }))) === "FORBIDDEN", "quem foi bloqueado não manda mais");
ok((await erro(() => svc.estanteDe(bia, pAna.id))) === "FORBIDDEN", "nem visita a estante");
ok((await erro(() => svc.entrarPeloConvite(pAna.inviteCode, bia, {}))) === "FORBIDDEN", "nem volta pelo convite");

// conta criada depois: o que era do aparelho passa para a conta
const eva = { token: tok(), userId: null };
const pEva = await svc.garantir(eva, { nome: "Eva", consentimentoIdade: idade });
await svc.entrarPeloConvite(pDani.inviteCode, eva, {});
const evaDepois = { token: eva.token, userId: await novoUsuario() };
ok((await svc.achar(evaDepois))!.id === pEva.id, "quem cria conta depois mantém a mesma pessoa");
const evaConta = { token: null, userId: evaDepois.userId };
ok((await svc.circulo(evaConta)).pessoas.some((p) => p.nome === "Dani"), "e continua com o círculo");

await pool.end(); await adm.end();
console.log("TODOS OS TESTES PASSARAM");
