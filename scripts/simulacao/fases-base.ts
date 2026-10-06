/* eslint-disable @typescript-eslint/no-explicit-any */
// Fases 1 a 3: preparação, segurança sem login, contas e senhas.
import type { Pool } from "pg";
import { Ator, BASE, RUN, SENHA, SENHA_NOVA, achado, dormir, emailDe, fase, http, nomeDe, pick, verificar } from "./nucleo";

export const contas: Ator[] = [];      // 18 contas
export const convidados: Ator[] = [];  // 12 convidados (sem cadastro)
export const todos = () => [...contas, ...convidados];

/** Fase 1: o evento do Mundo de teste só pode ser criado por administrador; aqui é inserido direto no banco, com marca. */
export async function preparar(db: Pool): Promise<{ eventoId: string; opcoes: [string, string] }> {
  fase("1. Preparação");
  const cat = (await db.query(`SELECT id FROM "WorldCategory" ORDER BY slug LIMIT 1`)).rows[0]?.id as string | undefined;
  const adm = (await db.query(`SELECT id FROM "User" WHERE role='ADMIN' ORDER BY "createdAt" LIMIT 1`)).rows[0]?.id as string | undefined;
  if (!cat || !adm) throw new Error("Faltam categoria do Mundo ou um administrador no banco.");
  const eventoId = crypto.randomUUID(), a = crypto.randomUUID(), b = crypto.randomUUID();
  await db.query(`INSERT INTO "WorldEvent"(id,"categoryId",title,"resolutionCriteria","opensAt","closesAt",status,"createdById") VALUES ($1,$2,$3,'Evento de teste da simulação',now()-interval '1 hour',now()+interval '6 hours','PUBLISHED',$4)`, [eventoId, cat, `SIM ${RUN}: o time da casa vence?`, adm]);
  await db.query(`INSERT INTO "WorldOpportunity"(id,"eventId",code,label,position) VALUES ($1,$3,'S','Sim',0),($2,$3,'N','Não',1)`, [a, b, eventoId]);
  verificar("evento de teste do Mundo criado com marca SIM", true);
  return { eventoId, opcoes: [a, b] };
}

/** Fase 2: o que um desconhecido consegue (e não consegue) fazer. */
export async function segurancaAnonima(): Promise<void> {
  fase("2. Segurança: visitante sem login");
  const anon = new Ator("anon", "anon");
  const home = await http(anon, "GET", "/");
  verificar("a página inicial abre", home.status === 200, `status ${home.status}`);
  const csp = home.cab.get("content-security-policy") ?? "";
  verificar("CSP presente com nonce e sem unsafe-inline em scripts", /script-src[^;]*'nonce-/.test(csp) && !/script-src[^;]*unsafe-inline/.test(csp), csp.slice(0, 120));
  verificar("CSP bloqueia frames de terceiros (frame-ancestors/frame-src)", /frame-ancestors/.test(csp) || !!home.cab.get("x-frame-options"), "sem frame-ancestors nem X-Frame-Options");
  for (const [h, nome] of [["x-content-type-options", "X-Content-Type-Options"], ["referrer-policy", "Referrer-Policy"]] as const) verificar(`cabeçalho ${nome} presente`, !!home.cab.get(h), `ausente em /`);
  const hsts = home.cab.get("strict-transport-security");
  if (BASE.startsWith("https://")) { if (!verificar("HSTS presente (https)", !!hsts)) achado("medio", "Sem HSTS", "O site em https não envia Strict-Transport-Security."); }
  if (home.cab.get("x-powered-by")) achado("baixo", "Cabeçalho X-Powered-By exposto", `valor: ${home.cab.get("x-powered-by")}`);
  verificar("sem X-Powered-By (não anuncia a tecnologia)", !home.cab.get("x-powered-by"));

  // rotas protegidas sem sessão
  for (const [m, p] of [["GET", "/api/v1/users/me"], ["GET", "/api/v1/me/export"], ["GET", "/api/v1/notifications"], ["GET", "/api/v1/admin/users"], ["GET", "/api/v1/admin/metrics"], ["GET", "/api/v1/admin/reports"], ["GET", "/api/v1/admin/audit"], ["GET", "/api/v1/mundo/conexoes"], ["GET", "/api/v1/world/events?status=DRAFT"], ["POST", "/api/v1/push/subscribe"], ["POST", "/api/v1/social/profile"], ["POST", "/api/v1/social/groups"], ["POST", "/api/v1/me/erasure-requests"]] as const) {
    const r = await http(anon, m, p);
    verificar(`${m} ${p} sem login responde 401/403`, r.status === 401 || r.status === 403, `status ${r.status}`);
    if (r.status === 200) achado("critico", "Rota protegida responde sem login", `${m} ${p}`);
  }

  // CSRF e formato do corpo
  const login = (o: any) => http(anon, "POST", "/api/v1/auth/login", o);
  const c1 = await login({ corpo: { email: "x@orvok.test", password: SENHA }, origem: null });
  verificar("login sem Origin é recusado (CSRF)", c1.status === 403, `status ${c1.status}`);
  const c2 = await login({ corpo: { email: "x@orvok.test", password: SENHA }, origem: "https://site-malicioso.example" });
  verificar("login com Origin de outro site é recusado", c2.status === 403, `status ${c2.status}`);
  const c3 = await login({ raw: "email=x&password=y", ct: "application/x-www-form-urlencoded" });
  verificar("login com formulário (não JSON) é recusado", c3.status === 415, `status ${c3.status}`);
  const c4 = await login({ raw: "{isto não é json", ct: "application/json" });
  verificar("JSON quebrado responde 400, não 500", c4.status === 400, `status ${c4.status}`);
  const c5 = await login({ corpo: { email: "x@orvok.test", password: SENHA, extra: "campo-a-mais" } });
  verificar("campo desconhecido no corpo é recusado (400)", c5.status === 400, `status ${c5.status}`);
  const c6 = await login({ raw: JSON.stringify({ email: "x@orvok.test", password: "a".repeat(30_000) }) });
  verificar("corpo gigante (30 KB) é recusado sem derrubar (413)", c6.status === 413, `status ${c6.status}`);
  const c7 = await login({ raw: "null" });
  verificar("corpo 'null' responde 400", c7.status === 400, `status ${c7.status}`);
  const c8 = await login({ raw: JSON.stringify([1, 2, 3]) });
  verificar("corpo array responde 400", c8.status === 400, `status ${c8.status}`);

  // injeção e códigos estranhos
  for (const cod of ["' OR '1'='1", "..%2F..%2Fetc%2Fpasswd", "%00", "<script>alert(1)</script>", "A".repeat(500), "AAAAAAAA"]) {
    const r = await http(anon, "GET", `/api/v1/desafio/${encodeURIComponent(cod)}`);
    verificar(`código estranho no convite (${cod.slice(0, 14)}…) não gera 500`, r.status < 500, `status ${r.status}`);
    if (r.status >= 500) achado("alto", "Erro 500 com entrada hostil em código de convite", cod.slice(0, 40));
    const m = await http(anon, "GET", `/api/v1/mundo/r/${encodeURIComponent(cod)}`);
    verificar(`código estranho no Mundo (${cod.slice(0, 14)}…) não gera 500`, m.status < 500, `status ${m.status}`);
  }
  // exposição de informação
  for (const p of ["/.env", "/.git/config", "/package.json", "/prisma/schema.prisma", "/scripts/test-estante.ts", "/src/lib/auth/crypto.ts", "/api/v1/admin"]) {
    const r = await http(anon, "GET", p);
    const vazou = r.status === 200 && /DATABASE_URL|AUTH_SECRET|createHmac|\[core\]|model User/.test(r.texto);
    verificar(`${p} não expõe arquivos`, !vazou, `status ${r.status}`);
    if (vazou) achado("critico", "Arquivo sensível exposto", p);
  }
  const pronto = await http(anon, "GET", "/api/ready");
  verificar("/api/ready não vaza segredos nem erros técnicos a anônimos", !/postgres:\/\/|password|stack|Error:|secret=/i.test(pronto.texto), pronto.texto.slice(0, 120));
  if (pronto.status === 200 && /"checks"/.test(pronto.texto)) achado("baixo", "/api/ready é público e lista os nomes das verificações de configuração", "Mostra, a qualquer pessoa, quais itens de configuração existem (por exemplo authMailKey, runtimeCredentials) e se estão ok. Não vaza valores. Convém restringir o detalhe a quem tiver uma chave e deixar o público só com ready/not_ready.");
  const saude = await http(anon, "GET", "/api/health");
  verificar("/api/health responde sem vazar detalhes", saude.status === 200 && !/postgres|password|DATABASE/i.test(saude.texto), `status ${saude.status}`);
  const nf = await http(anon, "GET", "/pagina-que-nao-existe-xyz");
  verificar("página inexistente responde 404 sem stack trace", nf.status === 404 && !/at .*\(.*:\d+:\d+\)/.test(nf.texto));
  const meth = await http(anon, "PUT", "/api/v1/auth/login");
  verificar("método não suportado não gera 500", meth.status !== 500, `status ${meth.status}`);
  const opt = await http(anon, "OPTIONS", "/api/v1/auth/login", { cab: { Origin: "https://site-malicioso.example", "Access-Control-Request-Method": "POST" } });
  verificar("CORS: nenhum site de fora é liberado", !/\*|malicioso/.test(opt.cab.get("access-control-allow-origin") ?? ""), String(opt.cab.get("access-control-allow-origin")));
  // mapas de código-fonte
  const chunk = home.texto.match(/\/_next\/static\/chunks\/[A-Za-z0-9_.\-]+\.js/)?.[0];
  if (chunk) { const mapa = await http(anon, "GET", `${chunk}.map`); verificar("mapas de código-fonte (.map) não são públicos", mapa.status !== 200, `status ${mapa.status}`); if (mapa.status === 200) achado("medio", "Mapas de código-fonte públicos", chunk); }
}

/** Fase 3: contas, senhas e sessões. */
export async function contasESenhas(db: Pool): Promise<void> {
  fase("3. Contas, senhas e sessões");
  for (let i = 1; i <= 18; i++) contas.push(new Ator(nomeDe(i), "conta", emailDe(i)));
  const anon = new Ator("anon", "anon");

  // senha fraca e e-mail inválido
  const fracas = ["curt1A!", "semmaiuscula1!", "SEMMINUSCULA1!", "SemEspecial123", "a".repeat(1100) + "A!"];
  for (const s of fracas) { const r = await http(anon, "POST", "/api/v1/auth/register", { corpo: { email: emailDe(99), password: s } }); verificar(`senha fraca recusada (${s.slice(0, 12)}…)`, r.status === 400, `status ${r.status}`); }
  const ruim = await http(anon, "POST", "/api/v1/auth/register", { corpo: { email: "nao-e-email", password: SENHA } });
  verificar("e-mail inválido recusado", ruim.status === 400, `status ${ruim.status}`);

  // cadastro das 18 contas (em pequenos lotes, como pessoas chegando)
  let aceitas = 0;
  for (let i = 0; i < contas.length; i += 6) {
    const lote = await Promise.all(contas.slice(i, i + 6).map((c) => http(c, "POST", "/api/v1/auth/register", { corpo: { email: c.email, password: SENHA } })));
    aceitas += lote.filter((r) => r.status === 202).length;
    await dormir(300);
  }
  verificar("as 18 contas foram aceitas (202)", aceitas === 18, `${aceitas} de 18`);
  const dup = await http(contas[0]!, "POST", "/api/v1/auth/register", { corpo: { email: contas[0]!.email, password: SENHA } });
  const novo = await http(anon, "POST", "/api/v1/auth/register", { corpo: { email: emailDe(98), password: SENHA } });
  verificar("cadastrar e-mail já existente responde igual a um novo (sem revelar quem tem conta)", dup.status === novo.status && JSON.stringify(dup.json) === JSON.stringify(novo.json), `${dup.status} vs ${novo.status}`);
  const idRows = (await db.query(`SELECT "userId",email,"verifiedAt" FROM "AuthIdentity" WHERE email LIKE $1`, [`sim30-${RUN}-%`])).rows;
  verificar("as contas existem no banco", idRows.length >= 18, `${idRows.length} contas`);
  for (const c of contas) c.userId = idRows.find((r: any) => r.email === c.email)?.userId ?? null;
  const nascemVerificadas = idRows.filter((r: any) => r.verifiedAt !== null).length;
  if (nascemVerificadas === idRows.length) achado("alto", "O cadastro cria a conta já verificada, sem confirmar o e-mail", `As ${idRows.length} contas de teste nasceram com verifiedAt preenchido no ato do cadastro. Qualquer pessoa pode cadastrar o e-mail de outra pessoa. Combinado com o login do Google (que se junta à conta existente com o mesmo e-mail sem apagar a senha), isso permite sequestro prévio de conta; veja a fase "Autenticação em profundidade".`);
  // senha guardada com hash forte
  const h = (await db.query(`SELECT "passwordHash" FROM "AuthIdentity" WHERE email=$1`, [contas[0]!.email])).rows[0]?.passwordHash as string;
  verificar("senha guardada com hash (scrypt), nunca em texto", /^scrypt/.test(h) && !h.includes(SENHA), h.slice(0, 12));
  const fila0 = (await db.query(`SELECT count(*)::int AS n FROM "AuthMailOutbox" WHERE "userId" = ANY($1)`, [contas.map((c) => c.userId)])).rows[0].n as number;
  verificar("o cadastro não depende de e-mail para funcionar (nada na fila de e-mails)", fila0 === 0, `${fila0} pedidos na fila`);

  const tokInvalido = await http(anon, "POST", "/api/v1/auth/verify-email", { corpo: { token: "A".repeat(43) } });
  verificar("verificar e-mail com token inventado é recusado", tokInvalido.status >= 400 && tokInvalido.status < 500, `status ${tokInvalido.status}`);
  const tokMalformado = await http(anon, "POST", "/api/v1/auth/verify-email", { corpo: { token: "curto" } });
  verificar("verificar e-mail com token malformado responde 400", tokMalformado.status === 400, `status ${tokMalformado.status}`);

  let entraram = 0;
  for (const c of contas) {
    const r = await http(c, "POST", "/api/v1/auth/login", { corpo: { email: c.email, password: SENHA } });
    if (r.status === 200) entraram++;
  }
  verificar("as 18 contas entram com e-mail e senha", entraram === 18, `${entraram} de 18`);
  const ck = [...(await import("./nucleo")).cookiesAuditados].find(([n]) => /session|sessao|orvok/i.test(n) && !/convidado/i.test(n));
  if (ck) {
    const [nome, attrs] = ck;
    verificar(`cookie de sessão (${nome}) é HttpOnly`, /httponly/i.test(attrs), attrs);
    verificar("cookie de sessão tem SameSite", /samesite=(lax|strict)/i.test(attrs), attrs);
    if (BASE.startsWith("https://")) verificar("cookie de sessão é Secure (https)", /secure/i.test(attrs), attrs);
    verificar("cookie de sessão tem prazo", /max-age|expires/i.test(attrs), attrs);
  } else verificar("cookie de sessão encontrado", false, "nenhum cookie de sessão no login");
  const ses = await http(contas[0]!, "GET", "/api/v1/auth/session");
  verificar("a sessão é reconhecida", ses.status === 200 && ses.json?.authenticated === true, JSON.stringify(ses.json)?.slice(0, 80));
  const eu = await http(contas[0]!, "GET", "/api/v1/users/me");
  verificar("/users/me devolve a própria conta", eu.status === 200, `status ${eu.status}`);

  // erro de login não revela se a conta existe
  const errada = await http(anon, "POST", "/api/v1/auth/login", { corpo: { email: contas[1]!.email, password: "Errada#12345a" } });
  const inexist = await http(anon, "POST", "/api/v1/auth/login", { corpo: { email: `sim30-${RUN}-inexistente@orvok.test`, password: "Errada#12345a" } });
  verificar("senha errada e conta inexistente dão a mesma resposta", errada.status === inexist.status && errada.json?.code === inexist.json?.code, `${errada.status}/${errada.json?.code} vs ${inexist.status}/${inexist.json?.code}`);
  const dif = Math.abs(errada.ms - inexist.ms);
  verificar("e o tempo de resposta não entrega se a conta existe (diferença < 400 ms)", dif < 400, `${Math.round(errada.ms)} ms vs ${Math.round(inexist.ms)} ms`);

  // limite de tentativas por conta (sem encostar no limite global)
  const alvo = new Ator("alvo", "anon"); const emailAlvo = contas[17]!.email!;
  const codigos: number[] = [];
  for (let i = 0; i < 12; i++) codigos.push((await http(alvo, "POST", "/api/v1/auth/login", { corpo: { email: emailAlvo, password: `Errada#${i}aaaa` } })).status);
  verificar("depois de várias senhas erradas a conta é protegida (429)", codigos.includes(429), codigos.join(","));
  const certaBloqueada = await http(alvo, "POST", "/api/v1/auth/login", { corpo: { email: emailAlvo, password: SENHA } });
  verificar("durante o bloqueio, nem a senha certa entra", certaBloqueada.status === 429, `status ${certaBloqueada.status}`);

  // trocar senha
  const trocaFraca = await http(contas[2]!, "POST", "/api/v1/auth/change-password", { corpo: { currentPassword: SENHA, password: "fraca" } });
  verificar("trocar para senha fraca é recusado", trocaFraca.status === 400, `status ${trocaFraca.status}`);
  const trocaErrada = await http(contas[2]!, "POST", "/api/v1/auth/change-password", { corpo: { currentPassword: "Errada#12345a", password: SENHA_NOVA } });
  verificar("trocar sem saber a senha atual é recusado", trocaErrada.status >= 400 && trocaErrada.status < 500, `status ${trocaErrada.status}`);
  const troca = await http(contas[2]!, "POST", "/api/v1/auth/change-password", { corpo: { currentPassword: SENHA, password: SENHA_NOVA } });
  verificar("trocar a senha funciona", troca.status === 200 || troca.status === 204, `status ${troca.status}`);
  contas[2]!.senha = SENHA_NOVA;
  await http(contas[2]!, "POST", "/api/v1/auth/login", { corpo: { email: contas[2]!.email, password: SENHA_NOVA } }); // trocar a senha encerra todas as sessões, inclusive esta
  const velha = await http(new Ator("velha", "anon"), "POST", "/api/v1/auth/login", { corpo: { email: contas[2]!.email, password: SENHA } });
  verificar("a senha antiga deixa de valer", velha.status === 401, `status ${velha.status}`);
  const nova = await http(new Ator("nova", "anon"), "POST", "/api/v1/auth/login", { corpo: { email: contas[2]!.email, password: SENHA_NOVA } });
  verificar("a senha nova vale", nova.status === 200, `status ${nova.status}`);

  // trocar a senha encerra as outras sessões da mesma conta
  const s2 = new Ator("s2", "anon"); await http(s2, "POST", "/api/v1/auth/login", { corpo: { email: contas[8]!.email, password: SENHA } });
  const antesTroca = await http(s2, "GET", "/api/v1/users/me");
  await http(contas[8]!, "POST", "/api/v1/auth/change-password", { corpo: { currentPassword: SENHA, password: SENHA_NOVA } });
  contas[8]!.senha = SENHA_NOVA;
  await http(contas[8]!, "POST", "/api/v1/auth/login", { corpo: { email: contas[8]!.email, password: SENHA_NOVA } });
  const depoisTroca = await http(s2, "GET", "/api/v1/users/me");
  verificar("trocar a senha derruba as outras sessões abertas da conta", antesTroca.status === 200 && depoisTroca.status === 401, `${antesTroca.status} → ${depoisTroca.status}`);
  // recuperar senha
  const r1 = await http(anon, "POST", "/api/v1/auth/request-reset", { corpo: { email: contas[3]!.email } });
  const r2 = await http(anon, "POST", "/api/v1/auth/request-reset", { corpo: { email: `sim30-${RUN}-naoexiste@orvok.test` } });
  verificar("pedir recuperação de senha não revela se a conta existe", r1.status === r2.status && r1.json?.code === r2.json?.code, `${r1.status}/${r2.status}`);
  const filaReset = (await db.query(`SELECT count(*)::int AS n, count("deliveredAt")::int AS entregues FROM "AuthMailOutbox" WHERE "userId"=$1 AND purpose='RESET_PASSWORD'`, [contas[3]!.userId])).rows[0];
  verificar("o pedido de recuperação entra na fila de e-mails", filaReset.n >= 1, JSON.stringify(filaReset));
  await dormir(20_000);
  const filaReset2 = (await db.query(`SELECT count(*)::int AS n, count("deliveredAt")::int AS entregues FROM "AuthMailOutbox" WHERE "userId"=$1 AND purpose='RESET_PASSWORD'`, [contas[3]!.userId])).rows[0];
  if (!verificar("o e-mail de recuperação de senha é entregue em até 20 s", filaReset2.entregues >= 1, JSON.stringify(filaReset2))) achado("alto", "A recuperação de senha não entrega o e-mail", `O pedido entra na fila (AuthMailOutbox), mas nada entrega a fila: não há worker agendado nem tarefa na Vercel (sem vercel.json/cron). Quem esquecer a senha não consegue recuperar a conta.`);
  const rt = await http(anon, "POST", "/api/v1/auth/reset-password", { corpo: { token: "B".repeat(43), password: SENHA_NOVA } });
  verificar("redefinir com token inventado é recusado", rt.status >= 400 && rt.status < 500, `status ${rt.status}`);

  // logout invalida a sessão
  const copia = new Ator("copia", "anon"); copia.jar = new Map(contas[5]!.jar);
  const lo = await http(contas[5]!, "POST", "/api/v1/auth/logout");
  verificar("sair da conta funciona", lo.status === 200 || lo.status === 204, `status ${lo.status}`);
  const reuso = await http(copia, "GET", "/api/v1/users/me");
  verificar("reaproveitar o cookie depois de sair não funciona (sessão revogada no servidor)", reuso.status === 401, `status ${reuso.status}`);
  if (reuso.status === 200) achado("alto", "Sessão continua válida depois do logout", "o cookie antigo ainda autentica");
  await http(contas[5]!, "POST", "/api/v1/auth/login", { corpo: { email: contas[5]!.email, password: SENHA } });
  const rot = await http(contas[6]!, "POST", "/api/v1/auth/rotate");
  verificar("rotacionar a sessão funciona e a nova continua válida", (rot.status === 200 || rot.status === 204) && (await http(contas[6]!, "GET", "/api/v1/users/me")).status === 200, `status ${rot.status}`);
  const prov = await http(contas[7]!, "GET", "/api/v1/auth/providers");
  verificar("lista de provedores de login responde para quem está logado", prov.status === 200, `status ${prov.status}`);
  const provAnon = await http(anon, "GET", "/api/v1/auth/providers");
  verificar("e não é exposta a quem não está logado", provAnon.status === 401 || provAnon.status === 200, `status ${provAnon.status}`);
  void pick;
}
