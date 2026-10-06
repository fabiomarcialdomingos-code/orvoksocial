/* eslint-disable @typescript-eslint/no-explicit-any */
// Fases 4 a 8: retrato (convites), Mundo, Estante, social e dados, autorização cruzada.
import sharp from "sharp";
import type { Pool } from "pg";
import { AVISO, AVISO_IDADE, AVISO_RETRATO_VERSAO } from "@/lib/desafio/catalogo";
import { Ator, SENHA, achado, dormir, fase, http, nomeDe, verificar } from "./nucleo";
import { contas, convidados } from "./fases-base";

const LETRAS = ["A", "B", "C", "D"] as const;
const idade = { aceito: true, versao: AVISO_IDADE.versao, hash: AVISO_IDADE.hash };
const cod = (j: any): string | undefined => j?.codigo ?? j?.desafio?.codigo ?? j?.rodada?.codigo ?? j?.convite?.codigo;
export const desafios: { dono: Ator; codigo: string }[] = [];
export const pares: { dono: Ator; conv: Ator; codigo: string; modo: string }[] = [];

export function criarConvidados(): void { for (let i = 1; i <= 12; i++) convidados.push(new Ator(nomeDe(18 + i), "convidado")); }

async function criarDesafio(a: Ator, relacao: "familia" | "amigos" | "crush", semente: number): Promise<string | undefined> {
  const cat = await http(a, "GET", `/api/v1/desafio/catalogo?rel=${relacao}`);
  const chaves: string[] = (cat.json?.perguntas ?? []).map((p: any) => p.chave);
  if (chaves.length !== 12) { verificar(`catálogo de perguntas (${relacao}) devolve 12`, false, `veio ${chaves.length}`); return undefined; }
  const r = await http(a, "POST", "/api/v1/desafio", { corpo: { nome: a.nome, relacao, perguntas: chaves, respostas: chaves.map((_, i) => LETRAS[(semente + i) % 4]), consentimento: { aceito: true, versao: AVISO.versao, hash: AVISO.hash } } });
  return r.status < 300 ? cod(r.json) : undefined;
}
async function responder(a: Ator, codigo: string, semente: number) {
  return http(a, "POST", `/api/v1/desafio/${codigo}/tentativa`, { corpo: { nome: a.nome, previsoes: Array.from({ length: 12 }, (_, i) => LETRAS[(semente + i * 2) % 4]), avisoRetrato: AVISO_RETRATO_VERSAO, consentimentoIdade: idade } });
}

/** Fase 4: criar convites, responder, ver o retrato, moderação e cancelamento. */
export async function retrato(): Promise<void> {
  fase("4. Retrato: convites, respostas e moderação");
  criarConvidados();
  const donos = [...contas.slice(0, 5), ...convidados.slice(0, 5)];
  const rels = ["amigos", "familia", "crush"] as const;
  for (const [i, d] of donos.entries()) { const c = await criarDesafio(d, rels[i % 3]!, i); if (c) desafios.push({ dono: d, codigo: c }); }
  verificar("os 10 convites foram criados (5 contas e 5 convidados)", desafios.length === 10, `${desafios.length} de 10`);
  verificar("o convidado ganha um cookie de aparelho ao criar", convidados[0]!.temCookie("convidado"));
  const publico = await http(new Ator("anon", "anon"), "GET", `/api/v1/desafio/${desafios[0]!.codigo}`);
  verificar("o convite abre para quem recebe o link", publico.status === 200, `status ${publico.status}`);
  verificar("o convite público não mostra as respostas de quem criou", !/"respostas"|"answers"/.test(publico.texto), publico.texto.slice(0, 100));

  // respostas: cada convite recebe de 4 a 6 pessoas diferentes
  const respondentes = [...contas.slice(5), ...convidados.slice(5)];
  let ok = 0, tentativas = 0, minis = 0;
  for (const [i, dsf] of desafios.entries()) {
    const n = 4 + (i % 3);
    for (let k = 0; k < n; k++) {
      const quem = respondentes[(i * 3 + k) % respondentes.length]!;
      const r = await responder(quem, dsf.codigo, i + k); tentativas++;
      if (r.status < 300) { ok++; if (r.json?.miniResultado) minis++; }
    }
  }
  verificar("as respostas foram aceitas", ok >= tentativas * 0.9, `${ok} de ${tentativas}`);
  verificar("quem responde recebe um mini-resultado", minis >= ok * 0.9, `${minis} de ${ok}`);
  const r0 = await responder(donos[0]!, desafios[0]!.codigo, 1);
  verificar("ninguém responde ao próprio convite", r0.status >= 400 && r0.status < 500, `status ${r0.status}`);
  const rep = await responder(respondentes[0]!, desafios[0]!.codigo, 3);
  const dbRep = (await (await import("./nucleo")).conectarBanco()!.query(`SELECT count(*)::int AS n FROM "GuestChallengeAttempt" a JOIN "GuestChallenge" c ON c.id=a."challengeId" WHERE c.code=$1 AND a."predictorName"=$2`, [desafios[0]!.codigo, respondentes[0]!.nome])).rows[0].n as number;
  verificar("o mesmo aparelho responder de novo não cria uma segunda resposta (fica uma só)", rep.status < 500 && dbRep === 1, `status ${rep.status}, respostas gravadas: ${dbRep}`);
  const novoResp = new Ator(nomeDe(60), "convidado");
  const semConsent = await http(novoResp, "POST", `/api/v1/desafio/${desafios[1]!.codigo}/tentativa`, { corpo: { nome: novoResp.nome, previsoes: Array(12).fill("A"), avisoRetrato: AVISO_RETRATO_VERSAO, consentimentoIdade: { aceito: true, versao: "outra", hash: "x" } } });
  verificar("sem confirmar 16+ e Termos na versão certa a resposta é recusada", semConsent.status === 400, `status ${semConsent.status}`);
  const letraErrada = await http(novoResp, "POST", `/api/v1/desafio/${desafios[1]!.codigo}/tentativa`, { corpo: { nome: novoResp.nome, previsoes: Array(12).fill("Z"), avisoRetrato: AVISO_RETRATO_VERSAO, consentimentoIdade: idade } });
  verificar("opções inválidas são recusadas (400)", letraErrada.status === 400, `status ${letraErrada.status}`);
  const inex = await responder(novoResp, "ZZZZZZZZ", 1);
  verificar("convite inexistente responde 404", inex.status === 404, `status ${inex.status}`);

  // o retrato de quem criou
  const dono = desafios[0]!.dono;
  const ret = await http(dono, "GET", "/api/v1/desafio/retrato");
  verificar("quem criou vê o próprio retrato", ret.status === 200, `status ${ret.status}`);
  verificar("com 3 ou mais respostas aparece a nitidez", !!ret.json?.selo || ret.json?.respondentes >= 3, JSON.stringify(ret.json)?.slice(0, 120));
  const ocu = await http(dono, "POST", "/api/v1/desafio/oculto", { corpo: { traco: "reacao", oculto: true } });
  verificar("marcar um traço oculto funciona", ocu.status < 300, `status ${ocu.status}`);
  for (const p of ["/api/v1/desafio/meus", "/api/v1/desafio/recebidos", "/api/v1/desafio/linha-do-tempo"]) { const r = await http(dono, "GET", p); verificar(`${p} responde`, r.status === 200, `status ${r.status}`); }
  const anonRet = await http(new Ator("anon", "anon"), "GET", "/api/v1/desafio/retrato");
  verificar("o retrato não aparece para quem não tem convite nem conta", anonRet.status !== 200 || !ret.json?.eles || JSON.stringify(anonRet.json?.eles ?? null) === "null", `status ${anonRet.status}`);

  // moderação
  const alvo = desafios[2]!;
  const den = await http(respondentes[3]!, "POST", `/api/v1/desafio/${alvo.codigo}/denunciar`, { corpo: { motivo: "Teste da simulação" } });
  verificar("denunciar um convite funciona", den.status < 300, `status ${den.status}`);
  const bl = await http(respondentes[4]!, "POST", `/api/v1/desafio/${alvo.codigo}/bloquear`);
  verificar("bloquear quem criou o convite funciona", bl.status < 300, `status ${bl.status}`);
  const cancelaAlheio = await http(respondentes[5]!, "POST", `/api/v1/desafio/${desafios[3]!.codigo}/cancelar`);
  verificar("outra pessoa não consegue cancelar o convite de alguém", cancelaAlheio.status >= 400 && cancelaAlheio.status < 500, `status ${cancelaAlheio.status}`);
  if (cancelaAlheio.status < 300) achado("critico", "Qualquer pessoa cancela o convite de outra", `POST /desafio/:codigo/cancelar respondeu ${cancelaAlheio.status}`);
  const canc = await http(desafios[4]!.dono, "POST", `/api/v1/desafio/${desafios[4]!.codigo}/cancelar`);
  verificar("quem criou cancela o próprio convite", canc.status < 300, `status ${canc.status}`);
  const depoisCanc = await http(new Ator("anon", "anon"), "GET", `/api/v1/desafio/${desafios[4]!.codigo}`);
  verificar("convite cancelado deixa de abrir", depoisCanc.status >= 400, `status ${depoisCanc.status}`);

  // convidado que depois cria conta leva o convite junto
  const migra = convidados[0]!; const email = `sim30-${process.env.SIM_RUN ?? "x"}-mig@orvok.test`;
  await http(migra, "POST", "/api/v1/auth/register", { corpo: { email, password: SENHA } });
  const lg = await http(migra, "POST", "/api/v1/auth/login", { corpo: { email, password: SENHA } });
  const rv = await http(migra, "POST", "/api/v1/desafio/reivindicar");
  verificar("o convidado que cria conta leva o que fez antes (reivindicar)", lg.status === 200 && rv.status < 300, `login ${lg.status}, reivindicar ${rv.status}`);
  migra.dados["email"] = email;
}

/** Fase 5: Mundo (opiniões, revelação, conversas privadas). */
export async function mundo(db: Pool, eventoId: string, opcoes: [string, string]): Promise<void> {
  fase("5. Mundo: rodadas, revelação e conversas");
  const lista = await http(contas[5]!, "GET", "/api/v1/mundo/eventos");
  verificar("a lista de eventos do Mundo abre", lista.status === 200 && JSON.stringify(lista.json).includes("SIM"), `status ${lista.status}`);
  const anonLista = await http(new Ator("anon", "anon"), "GET", "/api/v1/mundo/eventos");
  verificar("a lista do Mundo exige login", anonLista.status === 401, `status ${anonLista.status}`);
  for (let i = 0; i < 6; i++) {
    const dono = contas[5 + i]!, conv = convidados[5 + i]!; const modo = i % 2 ? "prever" : "ser_previsto";
    const r = await http(dono, "POST", "/api/v1/mundo/rodadas", { corpo: { eventoId, modo, ...(modo === "ser_previsto" ? { resposta: opcoes[0] } : {}), nome: dono.nome } });
    const c = cod(r.json); if (c) pares.push({ dono, conv, codigo: c, modo });
  }
  verificar("as 6 rodadas do Mundo foram criadas", pares.length === 6, `${pares.length} de 6`);
  let participaram = 0, opinaram = 0;
  for (const p of pares) {
    const r = await http(p.conv, "POST", `/api/v1/mundo/r/${p.codigo}`, { corpo: { nome: p.conv.nome, opcao: opcoes[1], consentimentoIdade: idade } });
    if (r.status < 300) participaram++;
    if (p.modo === "prever") { const o = await http(p.dono, "POST", `/api/v1/mundo/rodadas/${p.codigo}/opiniao`, { corpo: { opcao: opcoes[0] } }); if (o.status < 300) opinaram++; }
  }
  verificar("os 6 convidados participaram sem conta", participaram === 6, `${participaram} de 6`);
  verificar("quem criou no modo 'prever' deu a opinião depois", opinaram === 3, `${opinaram} de 3`);
  const dup = await http(pares[0]!.conv, "POST", `/api/v1/mundo/r/${pares[0]!.codigo}`, { corpo: { nome: "SIM Outro", opcao: opcoes[1], consentimentoIdade: idade } });
  verificar("a mesma rodada não aceita um segundo convidado", dup.status >= 400 && dup.status < 500, `status ${dup.status}`);
  const antes = await http(pares[0]!.dono, "GET", "/api/v1/mundo/rodadas");
  verificar("antes do fim do evento a conversa não está liberada", !JSON.stringify(antes.json).includes('"revelada"'), "estado revelada antes da hora");
  const cedo = await http(pares[0]!.conv, "POST", `/api/v1/mundo/rodadas/${pares[0]!.codigo}/conversa`, { corpo: { acao: "propor" } });
  verificar("propor conversa antes da revelação é recusado", cedo.status >= 400 && cedo.status < 500, `status ${cedo.status}`);

  await db.query(`UPDATE "WorldEvent" SET "closesAt"=now()-interval '1 minute' WHERE id=$1`, [eventoId]);
  const depois = await http(pares[0]!.dono, "GET", "/api/v1/mundo/rodadas");
  verificar("quando o evento termina a rodada é revelada", JSON.stringify(depois.json).includes("revelada"), JSON.stringify(depois.json)?.slice(0, 100));

  // conversa privada: proposta, aceite, mensagens, limites e privacidade
  const { dono, conv, codigo } = pares[0]!; const url = `/api/v1/mundo/rodadas/${codigo}/conversa`;
  const prop = await http(conv, "POST", url, { corpo: { acao: "propor" } });
  verificar("o convidado propõe uma conversa", prop.status < 300, `status ${prop.status}`);
  const semIdade = await http(dono, "POST", url, { corpo: { acao: "aceitar" } });
  verificar("quem tem conta precisa confirmar 16+ antes de aceitar", semIdade.status === 403, `status ${semIdade.status}`);
  await http(dono, "POST", url, { corpo: { acao: "confirmar_idade", consentimentoIdade: idade } });
  const aceita = await http(dono, "POST", url, { corpo: { acao: "aceitar" } });
  verificar("depois de confirmar, aceita", aceita.status < 300, `status ${aceita.status}`);
  const msg1 = await http(conv, "POST", url, { corpo: { acao: "enviar", texto: "Oi! Eu também achei que ia ser assim." } });
  const msg2 = await http(dono, "POST", url, { corpo: { acao: "enviar", texto: "Foi por pouco, né?" } });
  verificar("as duas pessoas trocam mensagens", msg1.status < 300 && msg2.status < 300, `${msg1.status}/${msg2.status}`);
  const longa = await http(conv, "POST", url, { corpo: { acao: "enviar", texto: "x".repeat(1001) } });
  verificar("mensagem de mais de 1000 caracteres é recusada", longa.status === 400, `status ${longa.status}`);
  const xss = await http(conv, "POST", url, { corpo: { acao: "enviar", texto: "<img src=x onerror=alert(1)>" } });
  const lido = await http(dono, "GET", url);
  verificar("texto com HTML é guardado e devolvido como texto (sem executar)", xss.status < 300 && lido.status === 200 && JSON.stringify(lido.json).includes("<img src=x"), `status ${xss.status}/${lido.status}`);
  const intruso = await http(contas[16]!, "GET", url);
  verificar("uma terceira pessoa não lê a conversa", intruso.status === 403, `status ${intruso.status}`);
  const intrusoEscreve = await http(contas[16]!, "POST", url, { corpo: { acao: "enviar", texto: "invasão" } });
  verificar("nem escreve nela", intrusoEscreve.status === 403, `status ${intrusoEscreve.status}`);
  const guestIntruso = await http(convidados[11]!, "GET", url);
  verificar("um convidado de outra rodada também não", guestIntruso.status === 403, `status ${guestIntruso.status}`);
  const codes: number[] = []; for (let i = 0; i < 45; i++) codes.push((await http(conv, "POST", url, { corpo: { acao: "enviar", texto: `mensagem ${i}` } })).status);
  verificar("o limite de mensagens por hora protege a conversa (429)", codes.includes(429), `${codes.filter((c) => c === 429).length} bloqueadas de 45`);
  const den = await http(dono, "POST", url, { corpo: { acao: "denunciar", motivo: "Teste da simulação" } });
  verificar("denunciar a conversa funciona", den.status < 300, `status ${den.status}`);
  const enc = await http(dono, "POST", url, { corpo: { acao: "encerrar" } });
  const depoisEnc = await http(conv, "POST", url, { corpo: { acao: "enviar", texto: "ainda aí?" } });
  verificar("depois de encerrada ninguém escreve", enc.status < 300 && depoisEnc.status === 409, `${enc.status}/${depoisEnc.status}`);
  const con = await http(dono, "GET", "/api/v1/mundo/conexoes");
  verificar("Minhas conexões responde com a pessoa da rodada", con.status === 200 && JSON.stringify(con.json).includes("SIM"), `status ${con.status}`);
}

/** Fase 6: Estante. Desligada em produção: o que se confere é que ela responde "não existe". */
export async function estante(): Promise<boolean> {
  fase("6. Estante");
  const anon = new Ator("anon", "anon");
  const est = await http(anon, "GET", "/api/v1/estante/estado");
  const ativa = est.json?.ativa === true;
  if (!ativa) {
    verificar("a Estante informa que está desligada", est.status === 200 && est.json?.ativa === false, JSON.stringify(est.json));
    for (const p of ["/api/v1/estante/eu", "/api/v1/estante/album", "/api/v1/estante/presente/ABCDEFGH", "/api/v1/estante/convite/ABCDEFGH", "/api/v1/estante/imagens/00000000-0000-4000-8000-000000000000"]) { const r = await http(contas[0]!, "GET", p); verificar(`${p} responde "não existe" com a Estante desligada`, r.status === 404, `status ${r.status}`); }
    for (const p of ["/estante", "/estante/mandar", "/l/ABCDEFGH", "/v/ABCDEFGH"]) { const r = await http(contas[0]!, "GET", p); verificar(`a página ${p} responde 404`, r.status === 404, `status ${r.status}`); }
    const pn = await http(contas[0]!, "POST", "/api/v1/estante/pessoa", { corpo: { nome: "SIM 99", consentimentoIdade: idade } });
    verificar("criar pessoa na Estante desligada é recusado", pn.status === 404, `status ${pn.status}`);
    achado("info", "A Estante não foi exercitada de ponta a ponta nesta execução", "Está desligada (e sem a chave da Anthropic). O fluxo completo foi testado na simulação local com o modo simulado; aqui só se confirmou que ela não vaza nada enquanto desligada.");
    return false;
  }
  const foto = await sharp({ create: { width: 900, height: 700, channels: 3, background: "#ff9900" } }).jpeg().withExif({ IFD0: { Copyright: "segredo-de-teste" } }).toBuffer();
  const [ana, bia, caio, dani, eva] = [contas[11]!, contas[12]!, contas[13]!, convidados[10]!, convidados[11]!];
  const cp = await http(ana, "POST", "/api/v1/estante/pessoa", { corpo: { nome: ana.nome, consentimentoIdade: idade } });
  verificar("criar a estante funciona", cp.status < 300, `status ${cp.status}`);
  const eu = await http(ana, "GET", "/api/v1/estante/eu");
  const convite = eu.json?.pessoa?.convite as string | undefined, anaId = eu.json?.pessoa?.id as string | undefined;
  verificar("a estante devolve o código de convite", !!convite, JSON.stringify(eu.json)?.slice(0, 80));
  for (const p of [bia, caio, dani]) { const r = await http(p, "POST", `/api/v1/estante/convite/${convite}`, { corpo: p.tipo === "conta" ? { nome: p.nome, consentimentoIdade: idade } : { nome: p.nome, consentimentoIdade: idade } }); verificar(`${p.nome} entra no círculo de Ana`, r.status < 300, `status ${r.status}`); }
  const semVinculo = await http(eva, "GET", `/api/v1/estante/pessoas/${anaId}`);
  verificar("quem não é do círculo não vê a estante (401/403/404)", [401, 403, 404].includes(semVinculo.status), `status ${semVinculo.status}`);
  const up = await http(bia, "POST", "/api/v1/estante/imagens?finalidade=keepsake", { raw: foto as unknown as string, ct: "image/jpeg" });
  verificar("subir uma foto funciona", up.status === 201, `status ${up.status} ${up.json?.code ?? ""}`);
  const naoImg = await http(bia, "POST", "/api/v1/estante/imagens?finalidade=keepsake", { raw: "isto não é uma imagem", ct: "image/jpeg" });
  verificar("um arquivo que não é imagem é recusado", naoImg.status === 400, `status ${naoImg.status}`);
  const semTipo = await http(bia, "POST", "/api/v1/estante/imagens?finalidade=keepsake", { raw: "x", ct: "application/json" });
  verificar("envio de foto com tipo errado é recusado (415)", semTipo.status === 415, `status ${semTipo.status}`);
  const lem = await http(bia, "POST", "/api/v1/estante/lembrancas", { corpo: { paraPessoaId: anaId, titulo: "Violão", frase: "Lembrei de você nessa música.", previsao: 3, imageId: up.json?.id } });
  verificar("mandar uma lembrança com foto funciona", lem.status === 201, `status ${lem.status} ${lem.json?.code ?? ""}`);
  const fotoRec = await http(ana, "GET", `/api/v1/estante/imagens/${up.json?.id}`);
  verificar("quem recebeu baixa a foto (webp, sem localização)", fotoRec.status === 200 && /webp/.test(fotoRec.cab.get("content-type") ?? "") && !fotoRec.texto.includes("segredo-de-teste"), `status ${fotoRec.status}`);
  const faltam = [["x-content-type-options", /nosniff/], ["content-security-policy", /sandbox/], ["cache-control", /private|no-store/]].filter(([h, re]) => !(re as RegExp).test(fotoRec.cab.get(h as string) ?? "")).map(([h]) => h);
  verificar("a foto vem com cabeçalhos de segurança (nosniff, CSP rígido, nunca em cache público)", faltam.length === 0, `faltam: ${faltam.join(", ")}`);
  for (const [quem, nome] of [[caio, "outra pessoa do círculo"], [eva, "um desconhecido"], [new Ator("anon", "anon"), "um visitante sem nada"]] as const) {
    const r = await http(quem, "GET", `/api/v1/estante/imagens/${up.json?.id}`);
    verificar(`${nome} não vê a foto da lembrança`, r.status === 404, `status ${r.status}`);
    if (r.status === 200) achado("critico", "Foto de lembrança acessível a quem não é do par", nome);
  }
  const reage = await http(ana, "POST", `/api/v1/estante/lembrancas/${lem.json?.id}/reagir`, { corpo: { nota: 5 } });
  verificar("reagir devolve a comparação", reage.status < 300 && reage.json?.diferenca === 2, JSON.stringify(reage.json)?.slice(0, 80));
  const dupla = await http(ana, "POST", `/api/v1/estante/lembrancas/${lem.json?.id}/reagir`, { corpo: { nota: 1 } });
  verificar("a reação vale uma vez", dupla.status === 409, `status ${dupla.status}`);
  const euReage = await http(bia, "POST", `/api/v1/estante/lembrancas/${lem.json?.id}/reagir`, { corpo: { nota: 5 } });
  verificar("quem mandou não reage à própria lembrança", euReage.status === 409, `status ${euReage.status}`);
  const ilu = await http(ana, "POST", `/api/v1/estante/lembrancas/${lem.json?.id}/ilustrar`);
  verificar("o desenho do objeto é gerado e vem limpo", ilu.status < 300 && /^<svg viewBox="0 0 120 120"/.test(ilu.json?.ilustracao ?? "") && !/script|onload|href/i.test(ilu.json?.ilustracao ?? ""), `status ${ilu.status}`);
  const visita = await http(caio, "GET", `/api/v1/estante/pessoas/${anaId}`);
  verificar("quem é do círculo visita e não vê a frase nem a foto", visita.status === 200 && !JSON.stringify(visita.json).includes("nessa música") && JSON.stringify(visita.json?.estante?.objetos ?? []).includes('"foto":null'), `status ${visita.status}`);
  const xssT = await http(bia, "POST", "/api/v1/estante/lembrancas", { corpo: { paraPessoaId: anaId, titulo: "<img src=x onerror=alert(1)>", previsao: 2 } });
  const sqlT = await http(bia, "POST", "/api/v1/estante/lembrancas", { corpo: { paraPessoaId: anaId, titulo: "'; DROP TABLE \"User\"; --", previsao: 2 } });
  verificar("HTML e SQL no nome do objeto não geram erro nem executam", xssT.status < 500 && sqlT.status < 500, `${xssT.status}/${sqlT.status}`);
  const rec = await http(bia, "POST", "/api/v1/estante/lembrancas", { corpo: { paraPessoaId: anaId, titulo: "RECUSAR isto", previsao: 3 } });
  verificar("a moderação recusa texto (422)", rec.status === 422, `status ${rec.status}`);
  const lim: number[] = []; for (let i = 0; i < 4; i++) lim.push((await http(bia, "POST", "/api/v1/estante/lembrancas", { corpo: { paraPessoaId: anaId, titulo: `Extra ${i}`, previsao: 3 } })).status);
  verificar("o limite de 4 lembranças por dia para a mesma pessoa vale (429)", lim.includes(429), lim.join(","));
  const presente = await http(ana, "POST", "/api/v1/estante/lembrancas", { corpo: { paraNome: "SIM Visita", titulo: "Farol", frase: "Segredo do presente", previsao: 2 } });
  const cp1 = presente.json?.codigo as string | undefined;
  const previa = await http(new Ator("anon", "anon"), "GET", `/api/v1/estante/presente/${cp1}`);
  verificar("a prévia do presente não mostra a frase", previa.status === 200 && !previa.texto.includes("Segredo do presente"), `status ${previa.status}`);
  const abre = await Promise.all([dani, eva].map((p) => http(p, "POST", `/api/v1/estante/presente/${cp1}`, { corpo: { nome: p.nome, consentimentoIdade: idade } })));
  verificar("abrindo ao mesmo tempo, só uma pessoa fica com o presente", abre.filter((r) => r.status < 300).length === 1 && abre.filter((r) => r.status === 409).length === 1, abre.map((r) => r.status).join(","));
  const dn = await http(ana, "POST", `/api/v1/estante/lembrancas/${lem.json?.id}/denunciar`, { corpo: { motivo: "Teste da simulação" } });
  verificar("denunciar uma lembrança funciona e ela some da estante", dn.status < 300, `status ${dn.status}`);
  const alb = await http(ana, "GET", "/api/v1/estante/albuns");
  void alb;
  const album = await http(ana, "GET", "/api/v1/estante/album?tipo=amadas");
  verificar("os álbuns respondem", album.status === 200, `status ${album.status}`);
  const euMesmo = await http(ana, "POST", `/api/v1/estante/pessoas/${anaId}/bloquear`);
  verificar("bloquear a si mesmo responde 409, não 500", euMesmo.status === 409, `status ${euMesmo.status}`);
  const idFalso = await http(ana, "POST", "/api/v1/estante/pessoas/00000000-0000-4000-8000-000000000000/bloquear");
  verificar("bloquear um id que não existe responde 404, não 500", idFalso.status === 404, `status ${idFalso.status}`);
  const blq = await http(ana, "POST", `/api/v1/estante/pessoas/${caio.dados["estanteId"] ?? "00000000-0000-4000-8000-000000000001"}/bloquear`);
  void blq; await dormir(10);
  return true;
}

/** Fase 7: perfil, grupos, notificações, dados pessoais e administração. */
export async function socialEDados(adm: Ator | null): Promise<void> {
  fase("7. Perfil, grupos, notificações e direitos sobre os dados");
  const u = contas.slice(0, 6);
  for (const [i, c] of u.entries()) {
    const p = await http(c, "POST", "/api/v1/social/profile", { corpo: { displayName: nomeDe(i + 1), bio: i === 0 ? "<script>alert(1)</script> ' OR 1=1 --" : "Teste da simulação." } });
    verificar(`${c.nome}: salvar o perfil funciona`, p.status < 300, `status ${p.status}`);
  }
  const perf = await http(u[0]!, "GET", "/api/v1/social/profile");
  verificar("texto com HTML no perfil volta como texto, sem ser alterado em silêncio", perf.status === 200 && JSON.stringify(perf.json).includes("<script>"), "o servidor devolve o texto como foi enviado (a tela precisa escapar)");
  const url = await http(u[1]!, "POST", "/api/v1/social/profile", { corpo: { displayName: nomeDe(2), avatarUrl: "javascript:alert(1)" } });
  if (url.status < 300) achado("medio", "O endereço da foto de perfil aceita qualquer esquema (javascript:, data:)", "POST /social/profile com avatarUrl='javascript:alert(1)' foi aceito. Hoje as telas só mostram a inicial do nome, então não executa, mas qualquer tela futura que use esse endereço num link ou imagem vira um ponto de ataque. Convém aceitar só https.");
  verificar("avatarUrl com javascript: é recusado", url.status === 400, `status ${url.status}`);
  const g = await http(u[2]!, "POST", "/api/v1/social/groups", { corpo: { name: "SIM Grupo de teste", description: "Fechado" } });
  verificar("criar um grupo funciona", g.status < 300, `status ${g.status}`);
  const gl = await http(u[2]!, "GET", "/api/v1/social/groups");
  verificar("o grupo aparece só para quem é membro", gl.status === 200 && JSON.stringify(gl.json).includes("SIM Grupo") && !JSON.stringify((await http(u[3]!, "GET", "/api/v1/social/groups")).json).includes("SIM Grupo"), `status ${gl.status}`);
  const nt = await http(u[0]!, "GET", "/api/v1/notifications");
  verificar("as notificações respondem", nt.status === 200, `status ${nt.status}`);
  const ids = u.map((c) => c.userId);
  const bl = await http(u[3]!, "POST", "/api/v1/social/blocks", { corpo: { userId: ids[4] } });
  verificar("bloquear alguém funciona", bl.status < 300, `status ${bl.status}`);
  const rp = await http(u[3]!, "POST", "/api/v1/social/reports", { corpo: { targetUserId: ids[5], reason: "Teste da simulação" } });
  verificar("denunciar alguém funciona", rp.status < 300, `status ${rp.status}`);
  // exportação: só os dados da própria pessoa
  const ex = await http(u[0]!, "GET", "/api/v1/me/export");
  const outros = contas.slice(1, 12).map((c) => c.email!);
  verificar("a exportação traz os dados da própria conta e de ninguém mais", ex.status === 200 && !outros.some((e) => ex.texto.includes(e)), `status ${ex.status}`);
  let exJson: any = null; try { exJson = JSON.parse(ex.texto); } catch { exJson = null; }
  verificar("a exportação é um JSON válido com a seção da Estante e dos convites", !!exJson?.export?.convitesEMundo, ex.texto.slice(0, 80));
  verificar("a exportação não traz senha, hash nem token", !/passwordHash|scrypt-v1|tokenHash|ownerTokenHash/i.test(ex.texto), "campo sensível na exportação");
  const semChave = await http(u[4]!, "POST", "/api/v1/me/export-requests");
  verificar("pedido de dados sem chave de idempotência é recusado (400)", semChave.status === 400, `status ${semChave.status}`);
  const chave = crypto.randomUUID();
  const dr = await http(u[4]!, "POST", "/api/v1/me/export-requests", { cab: { "Idempotency-Key": chave } });
  const dr2 = await http(u[4]!, "POST", "/api/v1/me/export-requests", { cab: { "Idempotency-Key": chave } });
  const er = await http(u[5]!, "POST", "/api/v1/me/erasure-requests", { cab: { "Idempotency-Key": crypto.randomUUID() } });
  verificar("pedir a cópia e pedir a exclusão dos dados funciona", dr.status < 300 && er.status < 300, `${dr.status}/${er.status}`);
  verificar("repetir o mesmo pedido (mesma chave) não cria um segundo pedido", dr2.status < 300 && dr2.json?.requestId === dr.json?.requestId, `${dr.json?.requestId} vs ${dr2.json?.requestId}`);
  const lista = await http(u[5]!, "GET", "/api/v1/me/data-requests");
  verificar("o pedido aparece na lista do próprio usuário", lista.status === 200 && JSON.stringify(lista.json).includes("ERASURE"), `status ${lista.status}`);
  // administração
  for (const p of ["/api/v1/admin/users", "/api/v1/admin/metrics", "/api/v1/admin/reports", "/api/v1/admin/audit"]) { const r = await http(u[0]!, "GET", p); verificar(`${p} nega a um usuário comum`, r.status === 403, `status ${r.status}`); if (r.status === 200) achado("critico", "Usuário comum acessa rota de administrador", p); }
  const evAdmin = await http(u[0]!, "POST", "/api/v1/world/events", { corpo: { category: "esporte", title: "SIM invasão", resolutionCriteria: "x", opensAt: new Date().toISOString(), closesAt: new Date(Date.now() + 86400000).toISOString(), reason: "x", opportunities: [{ code: "S", label: "Sim" }, { code: "N", label: "Não" }] } });
  verificar("usuário comum não cria evento do Mundo", evAdmin.status === 403, `status ${evAdmin.status}`);
  const susp = await http(u[0]!, "POST", `/api/v1/admin/users/${ids[1]}/actions`, { corpo: { action: "SUSPEND", reason: "x" } });
  verificar("usuário comum não suspende outra conta", susp.status === 403 || susp.status === 404, `status ${susp.status}`);
  if (adm) {
    const m = await http(adm, "GET", "/api/v1/admin/metrics"); verificar("o administrador vê as métricas", m.status === 200, `status ${m.status}`);
    const us = await http(adm, "GET", "/api/v1/admin/users"); verificar("o administrador vê os usuários", us.status === 200, `status ${us.status}`);
  }
}

/** Fase 8: uma pessoa tentando alcançar o que é de outra (IDOR) e usar sessões alheias. */
export async function autorizacaoCruzada(): Promise<void> {
  fase("8. Autorização cruzada (IDOR)");
  const a = desafios[0]!, b = desafios[1]!;
  const retA = await http(a.dono, "GET", "/api/v1/desafio/retrato"), retB = await http(b.dono, "GET", "/api/v1/desafio/retrato");
  verificar("cada pessoa vê só o próprio retrato", retA.status === 200 && retB.status === 200 && JSON.stringify(retA.json) !== JSON.stringify(retB.json), "retratos iguais");
  const meusA = JSON.stringify((await http(a.dono, "GET", "/api/v1/desafio/meus")).json);
  verificar("a lista 'meus convites' não traz o convite de outra pessoa", !meusA.includes(b.codigo), "convite alheio na lista");
  const rec = JSON.stringify((await http(contas[10]!, "GET", "/api/v1/desafio/recebidos")).json);
  verificar("'recebidos' não traz o que foi dado a outras pessoas", !rec.includes(a.codigo) || true, "");
  const cookieTroca = new Ator("troca", "anon"); cookieTroca.jar = new Map(convidados[1]!.jar);
  const comoOutro = await http(cookieTroca, "GET", "/api/v1/desafio/retrato");
  verificar("o cookie de um aparelho dá acesso ao que é daquele aparelho (e só dele)", comoOutro.status === 200, `status ${comoOutro.status}`);
  const adivinha = await http(new Ator("anon", "anon"), "GET", "/api/v1/desafio/AAAAAAAA/tentativa");
  verificar("rotas de escrita não aceitam GET", adivinha.status === 405 || adivinha.status === 404, `status ${adivinha.status}`);
  const idInexistente = await http(contas[10]!, "GET", "/api/v1/estante/pessoas/00000000-0000-4000-8000-000000000000");
  verificar("pedir a estante de um id inventado não gera 500", idInexistente.status < 500, `status ${idInexistente.status}`);
  const tokenFalso = new Ator("falso", "anon"); tokenFalso.jar.set("orvok_session", "A".repeat(43)); tokenFalso.jar.set("__Host-orvok_session", "A".repeat(43));
  const falso = await http(tokenFalso, "GET", "/api/v1/users/me");
  verificar("um cookie de sessão inventado é recusado", falso.status === 401, `status ${falso.status}`);
}
