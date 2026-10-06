// Testa a Estante: pessoas, círculo, lembranças, presentes, reação, comparação, visitas, bloqueio e privacidade.
// Uso: AUTH_SECRET=... AUTH_DATABASE_URL=(orvok_auth_runtime) DATABASE_URL=(dono) npx tsx scripts/test-estante.ts
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import sharp from "sharp";
import { AVISO_IDADE_HASH, AVISO_IDADE_VERSAO } from "@/lib/desafio/catalogo";
import type { Ilustrador } from "@/lib/estante/ilustrador";
import { EXEMPLOS } from "@/lib/estante/ilustrador";
import type { Moderador } from "@/lib/estante/moderacao";
import { sanitizarSvg } from "@/lib/estante/svg";
import { EstanteService, comparar } from "@/lib/estante/service";

const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
const adm = new Pool({ connectionString: process.env.DATABASE_URL });
// Moderador de mentira: aprova tudo, exceto o que o teste mandar recusar.
let recusarImagem = false, indisponivel = false, configurado = true;
const moderador: Moderador = {
  configurado: () => configurado,
  imagem: async () => (indisponivel ? { ok: false, motivo: "indisponivel" } : recusarImagem ? { ok: false, motivo: "nudez" } : { ok: true, motivo: "ok" }),
  texto: async (t) => (t.includes("RECUSAR") ? { ok: false, motivo: "assedio" } : { ok: true, motivo: "ok" }),
};
// Ilustrador de mentira: devolve um desenho limpo, ou nada quando o teste mandar falhar.
let ilustradorOk = true, ilustradorLigado = true, chamadasIlustrador = 0;
const ilustrador: Ilustrador = {
  configurado: () => ilustradorLigado,
  gerar: async () => { chamadasIlustrador++; return ilustradorOk ? sanitizarSvg(EXEMPLOS[0]!.svg) : null; },
};
const svc = new EstanteService(pool, moderador, ilustrador);
const ok = (c: boolean, m: string) => { if (!c) { console.error("FALHOU:", m); process.exit(1); } console.log("ok -", m); };
const erro = async (f: () => Promise<unknown>) => { try { await f(); return "ok"; } catch (e) { return (e as { code?: string }).code ?? (e as Error).name; } };
const idade = { aceito: true as const, versao: AVISO_IDADE_VERSAO, hash: AVISO_IDADE_HASH };
const novoUsuario = async () => { const id = randomUUID(); await adm.query(`INSERT INTO "User"(id,"updatedAt") VALUES ($1,now())`, [id]); return id; };
const tok = () => randomUUID() + randomUUID();

// O banco de teste guarda o cache de desenhos entre execuções; cada rodada começa sem ele.
await adm.query(`DELETE FROM "ShelfIllustration"`);

// interruptor
ok((await svc.ativa()) === false, "a Estante nasce desligada");
await svc.ligar(true); ok((await svc.ativa()) === true, "dá para ligar");
configurado = false; ok((await svc.ativa()) === false, "ligada, mas sem moderação configurada, continua desligada"); configurado = true;
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

// fotos
const foto = (lado = 2000, exif = false) => {
  const img = sharp({ create: { width: lado, height: Math.round(lado * 0.75), channels: 3, background: "#ff9900" } }).jpeg();
  return (exif ? img.withExif({ IFD0: { Copyright: "segredo", Artist: "alguem" } }) : img).toBuffer();
};
const contar = async (q: string, p: unknown[] = []) => Number((await adm.query(q, p)).rows[0].n);
ok((await erro(() => svc.subirImagem(caio, Buffer.from("isto não é uma foto"), "keepsake"))) === "INVALID_INPUT", "arquivo que não é imagem é recusado");
ok((await erro(() => svc.subirImagem(caio, Buffer.alloc(0), "keepsake"))) === "INVALID_INPUT", "arquivo vazio é recusado");
ok((await erro(async () => svc.subirImagem({ token: tok(), userId: null }, await foto(), "keepsake"))) === "UNAUTHENTICATED", "quem não participou não sobe foto");
const entradaComExif = await foto(2000, true);
ok(((await sharp(entradaComExif).metadata()).exif ?? null) !== null, "a foto de teste tem metadados de verdade");
const up = await svc.subirImagem(dani, entradaComExif, "keepsake");
ok(up.largura === 1280, "a foto da lembrança é reduzida para 1280 px");
const guardada = await svc.imagem(dani, up.id);
const metaGuardada = await sharp(guardada.bytes).metadata();
ok(metaGuardada.format === "webp" && !metaGuardada.exif && !metaGuardada.xmp, "a foto guardada é webp e não tem nenhum metadado (nem localização)");
ok(guardada.bytes.length < entradaComExif.length, "e é menor que a original");
recusarImagem = true;
ok((await erro(async () => svc.subirImagem(dani, await foto(900), "keepsake"))) === "CONTENT_REJECTED", "a moderação recusa uma foto");
ok(await contar(`SELECT count(*) AS n FROM "ShelfImage" WHERE "ownerId"=$1`, [pDani.id]) === 1, "foto recusada não é guardada");
ok(await contar(`SELECT count(*) AS n FROM "ShelfModerationLog" WHERE "personId"=$1 AND NOT ok`, [pDani.id]) === 1, "só fica o registro da decisão");
recusarImagem = false; indisponivel = true;
ok((await erro(async () => svc.subirImagem(dani, await foto(900), "keepsake"))) === "SERVICE_UNAVAILABLE", "se a moderação não responde, a foto não entra (e não é culpa de quem enviou)");
indisponivel = false;
recusarImagem = true;
for (let i = 0; i < 4; i++) await erro(async () => svc.subirImagem(caio, await foto(500), "keepsake"));
const rec = [] as string[]; for (let i = 0; i < 6; i++) rec.push(await erro(async () => svc.subirImagem(caio, await foto(500), "keepsake")));
ok(rec.includes("RATE_LIMITED"), "quem é recusado várias vezes no dia espera até o dia seguinte");
recusarImagem = false;

// fotinha de perfil
const avA = await svc.subirImagem(ana, await foto(1500), "avatar");
ok(avA.largura === 512 && avA.altura === 512, "a fotinha vira um quadrado de 512 px");
await svc.definirAvatar(ana, avA.id);
ok((await svc.circulo(dani)).pessoas.find((p) => p.nome === "Ana")!.avatar === avA.id, "o círculo enxerga a fotinha");
ok((await svc.imagem(dani, avA.id)).bytes.length > 0 && (await svc.imagem(ana, avA.id)).bytes.length > 0, "a pessoa e o círculo baixam a fotinha");
ok((await erro(() => svc.imagem(caio, avA.id))) === "NOT_FOUND", "quem não é do círculo não vê nem sabe que existe");
ok((await erro(() => svc.definirAvatar(dani, avA.id))) === "NOT_FOUND", "ninguém usa a foto de outra pessoa");
ok((await erro(() => svc.definirAvatar(ana, up.id))) === "NOT_FOUND", "uma foto de lembrança não vira fotinha");
const avA2 = await svc.subirImagem(ana, await foto(900), "avatar");
await svc.definirAvatar(ana, avA2.id);
ok((await erro(() => svc.imagem(ana, avA.id))) === "NOT_FOUND" && await contar(`SELECT count(*) AS n FROM "ShelfImage" WHERE id=$1`, [avA.id]) === 0, "trocar a fotinha apaga a antiga de verdade");

// foto dentro da lembrança
const comFoto = await svc.enviar(dani, { titulo: "Praia", frase: "Aquele pôr do sol.", previsao: 2, paraPessoaId: pAna.id, imageId: up.id });
ok((await svc.imagem(ana, up.id)).bytes.length > 0 && (await svc.imagem(dani, up.id)).bytes.length > 0, "quem deu e quem recebeu baixam a foto da lembrança");
ok((await erro(() => svc.imagem(bia, up.id))) === "NOT_FOUND" && (await erro(() => svc.imagem(caio, up.id))) === "NOT_FOUND", "mais ninguém, nem do mesmo círculo, vê a foto");
ok((await svc.estanteDe(bia, pAna.id)).objetos.every((o) => o.foto === null), "o visitante vê o desenho, nunca a foto");
ok((await svc.estanteDe(dani, pAna.id)).objetos.find((o) => o.objeto === "Praia")!.foto === up.id, "quem deu vê a própria foto na estante de quem recebeu");
ok((await erro(() => svc.enviar(dani, { titulo: "Outra", previsao: 3, paraPessoaId: pAna.id, imageId: up.id }))) === "NOT_FOUND", "uma foto só serve a uma lembrança");
const fotoDaBia = await svc.subirImagem(bia, await foto(800), "keepsake");
ok((await erro(() => svc.enviar(dani, { titulo: "Roubada", previsao: 3, paraPessoaId: pAna.id, imageId: fotoDaBia.id }))) === "NOT_FOUND", "ninguém manda a foto de outra pessoa");
const antesTexto = await contar(`SELECT count(*) AS n FROM "Keepsake"`);
ok((await erro(() => svc.enviar(dani, { titulo: "Teste", frase: "RECUSAR isto", previsao: 3, paraPessoaId: pAna.id }))) === "CONTENT_REJECTED", "a moderação também recusa texto");
ok(await contar(`SELECT count(*) AS n FROM "Keepsake"`) === antesTexto, "e nada é criado quando o texto é recusado");
const lemb = (await svc.minhaEstante(ana))!.objetos.find((o) => o.objeto === "Praia")!;
ok(lemb.foto === up.id, "a foto aparece na estante de quem recebeu");
configurado = false;
ok((await erro(() => svc.enviar(dani, { titulo: "Sem moderação", previsao: 3, paraPessoaId: pAna.id }))) === "SERVICE_UNAVAILABLE", "sem moderação configurada ninguém publica nada");
ok((await erro(async () => svc.subirImagem(dani, await foto(500), "keepsake"))) === "SERVICE_UNAVAILABLE", "nem foto");
configurado = true;

// álbuns que se montam sozinhos
const albuns = (await svc.albuns(ana))!;
ok(albuns.deQuem.find((x) => x.nome === "Bia")!.quantidade === 4 && albuns.deQuem.find((x) => x.nome === "Dani")!.quantidade === 1, "o álbum 'de quem' agrupa o que cada pessoa deu");
ok(albuns.amadas === 1 && albuns.anos.length === 1 && albuns.anos[0]!.quantidade === 5, "há o álbum das mais amadas e o do ano");
ok(albuns.vocesDois.find((x) => x.nome === "Bia")!.quantidade === 4 && albuns.vocesDois.find((x) => x.nome === "Dani")!.quantidade === 2, "e o álbum de vocês dois conta as duas direções");
const dele = await svc.album(ana, { tipo: "vocesDois", pessoaId: pDani.id });
ok(dele.length === 2 && dele[0]!.objeto === "Farol" && dele[0]!.souEuQuemDeu && dele[1]!.objeto === "Praia" && !dele[1]!.souEuQuemDeu, "a história de vocês dois vem em ordem, nas duas direções");
const delaAoContrario = await svc.album(dani, { tipo: "vocesDois", pessoaId: pAna.id });
ok(delaAoContrario.length === 2 && delaAoContrario[0]!.souEuQuemDeu === false, "a outra pessoa vê a mesma história do seu lado");
ok((await erro(() => svc.album(caio, { tipo: "vocesDois", pessoaId: pAna.id }))) === "FORBIDDEN", "quem não é do círculo não abre o álbum");
ok((await svc.album(ana, { tipo: "de", pessoaId: pBia.id })).length === 4 && (await svc.album(bia, { tipo: "de", pessoaId: pAna.id })).length === 0, "o álbum 'de' só mostra o que a pessoa recebeu");
const mais = await svc.album(ana, { tipo: "amadas" });
ok(mais.length === 1 && mais[0]!.reacao === 5 && mais[0]!.frase !== undefined, "o álbum das mais amadas traz a reação");

// ilustração dos objetos
const vio = await svc.enviar(ana, { titulo: "Violão", previsao: 3, paraPessoaId: pDani.id });
ok((await erro(() => svc.ilustrar(bia, vio.id))) === "NOT_FOUND", "quem não tem a ver com a lembrança não pede o desenho");
const d1 = await svc.ilustrar(dani, vio.id);
ok(d1.gerada && d1.ilustracao!.startsWith("<svg viewBox") && chamadasIlustrador === 1, "quem recebeu pede e o desenho é feito");
const d2 = await svc.ilustrar(ana, vio.id);
ok(!d2.gerada && d2.ilustracao === d1.ilustracao && chamadasIlustrador === 1, "pedir de novo devolve o mesmo desenho, sem gastar outra chamada");
ok((await svc.minhaEstante(dani))!.objetos.find((o) => o.objeto === "Violão")!.ilustracao === d1.ilustracao, "o desenho aparece na estante");
const vio2 = await svc.enviar(ana, { titulo: "  VIOLÃO ", previsao: 4, paraPessoaId: pDani.id });
const d3 = await svc.ilustrar(ana, vio2.id);
ok(d3.ilustracao === d1.ilustracao && chamadasIlustrador === 1, "o mesmo objeto, com outra grafia, reaproveita o desenho de todos");
const linhaCache = (await adm.query(`SELECT "key",svg FROM "ShelfIllustration"`)).rows.find((r: { svg: string }) => r.svg === d1.ilustracao);
ok(linhaCache.key.length === 64 && linhaCache.key !== "violao" && !JSON.stringify(linhaCache).toLowerCase().includes("viol"), "o cache guarda só o resumo do nome, não o que a pessoa escreveu");
ilustradorOk = false;
const vio3 = await svc.enviar(ana, { titulo: "Coisa impossível de desenhar", previsao: 3, paraPessoaId: pDani.id });
const d4 = await svc.ilustrar(ana, vio3.id);
ok(d4.ilustracao === null && d4.motivo === "indisponivel", "se não dá para desenhar, devolve nada e a tela usa o desenho de reserva");
ok(await contar(`SELECT count(*) AS n FROM "Keepsake" WHERE id=$1 AND "illustrationSvg" IS NOT NULL`, [vio3.id]) === 0, "e nada é gravado");
ilustradorOk = true;
ok((await svc.ilustrar(ana, vio3.id)).gerada === true, "dá para tentar de novo depois e funciona");
ilustradorLigado = false;
const vio4 = await svc.enviar(ana, { titulo: "Outro objeto", previsao: 3, paraPessoaId: pDani.id });
ok((await svc.ilustrar(ana, vio4.id)).motivo === "indisponivel", "sem ilustrador configurado não desenha e não dá erro");
ilustradorLigado = true;
process.env.ORVOK_ILUSTRACOES_POR_DIA = "0";
ok((await svc.ilustrar(ana, vio4.id)).motivo === "limite_diario", "o teto de desenhos novos por dia protege a conta");
delete process.env.ORVOK_ILUSTRACOES_POR_DIA;

// denúncias e remoção pela equipe
const dFoto = await svc.subirImagem(dani, await foto(700), "keepsake");
const dLemb = await svc.enviar(dani, { titulo: "Para denunciar", frase: "Texto da lembrança.", previsao: 3, paraPessoaId: pAna.id, imageId: dFoto.id });
ok((await erro(() => svc.denunciar(dani, dLemb.id, "não gostei"))) === "NOT_FOUND", "quem mandou não denuncia a própria lembrança");
ok((await erro(() => svc.denunciar(bia, dLemb.id, "não gostei"))) === "NOT_FOUND", "quem não recebeu também não");
ok((await erro(() => svc.denunciar(ana, dLemb.id, "  "))) === "ZodError", "a denúncia precisa de um motivo");
await svc.denunciar(ana, dLemb.id, "Isso me incomodou.");
ok((await svc.minhaEstante(ana))!.objetos.every((o) => o.id !== dLemb.id), "a lembrança denunciada some da estante de quem denunciou na hora");
ok(await contar(`SELECT count(*) AS n FROM "ShelfReport" WHERE "keepsakeId"=$1 AND state='OPEN'`, [dLemb.id]) === 1, "a denúncia fica registrada para revisão");
await svc.denunciar(ana, dLemb.id, "De novo.");
ok(await contar(`SELECT count(*) AS n FROM "ShelfReport" WHERE "keepsakeId"=$1`, [dLemb.id]) === 1, "denunciar de novo não duplica");
const rem = execFileSync("psql", [process.env.DATABASE_URL!, "-v", "ON_ERROR_STOP=1", "-At", "-F", " ", "-v", `lembranca=${dLemb.id}`, "-f", "scripts/estante-remover.sql"], { encoding: "utf8" });
ok(/\n?1 1 1\n/.test(rem), "o script da equipe remove a lembrança, apaga a foto e resolve a denúncia");
ok(await contar(`SELECT count(*) AS n FROM "ShelfImage" WHERE id=$1`, [dFoto.id]) === 0 && (await erro(() => svc.imagem(dani, dFoto.id))) === "NOT_FOUND", "a foto foi apagada de verdade");
ok(await contar(`SELECT count(*) AS n FROM "Keepsake" WHERE id=$1 AND state='REMOVED'`, [dLemb.id]) === 1 && await contar(`SELECT count(*) AS n FROM "ShelfReport" WHERE "keepsakeId"=$1 AND state='RESOLVED'`, [dLemb.id]) === 1, "e a denúncia ficou resolvida");

// esconder, recolher e bloquear
const antesDeEsconder = (await svc.minhaEstante(ana))!.objetos.length;
await svc.ocultar(ana, est!.objetos[3]!.id);
ok((await svc.minhaEstante(ana))!.objetos.length === antesDeEsconder - 1, "quem recebeu pode esconder um objeto");
const l5 = await svc.enviar(dani, { titulo: "Livro", previsao: 4, paraPessoaId: pAna.id });
ok((await erro(() => svc.recolher(ana, l5.id))) === "NOT_FOUND", "só quem mandou recolhe");
await svc.recolher(dani, l5.id);
const comFoto2 = await svc.subirImagem(dani, await foto(600), "keepsake");
const l6 = await svc.enviar(dani, { titulo: "Para recolher", previsao: 3, paraPessoaId: pAna.id, imageId: comFoto2.id });
await svc.recolher(dani, l6.id);
ok((await erro(() => svc.imagem(dani, comFoto2.id))) === "NOT_FOUND" && await contar(`SELECT count(*) AS n FROM "ShelfImage" WHERE id=$1`, [comFoto2.id]) === 0, "recolher uma lembrança apaga a foto de verdade");
void comFoto;
ok((await erro(() => svc.reagir(ana, l5.id, 3))) === "CONFLICT", "lembrança recolhida não aceita reação");
ok((await erro(() => svc.bloquear(ana, pAna.id))) === "CONFLICT", "ninguém bloqueia a si mesmo (antes dava erro 500 no banco)");
ok((await erro(() => svc.bloquear(ana, randomUUID()))) === "NOT_FOUND", "bloquear um id que não existe responde 404 (antes dava erro 500 no banco)");
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
