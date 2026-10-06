// Testa as correções de autenticação achadas pela simulação de 30 usuários:
// sequestro prévio de conta, bloqueio de login que não trava o dono, confirmação de e-mail ligável e entrega da fila.
// Uso: AUTH_SECRET=... AUTH_MAIL_KEY=(64 hex) AUTH_DATABASE_URL=(orvok_auth_runtime) DATABASE_URL=(dono) npx tsx scripts/test-auth.ts
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { deliverNextAuthMail } from "@/lib/auth/mail";
import { AuthService, type AuthMailPayload } from "@/lib/auth/service";

const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
const adm = new Pool({ connectionString: process.env.DATABASE_URL });
const auth = new AuthService(pool);
const ok = (c: boolean, m: string) => { if (!c) { console.error("FALHOU:", m); process.exit(1); } console.log("ok -", m); };
const erro = async (f: () => Promise<unknown>) => { try { await f(); return "ok"; } catch (e) { return (e as { code?: string }).code ?? (e as Error).name; } };
const R = randomUUID().slice(0, 8);
const email = (n: string) => `auth-${R}-${n}@orvok.test`;
const SENHA = "Teste#Senha2026", OUTRA = "Outra#Senha2026";
const sessaoViva = async (userId: string) => Number((await adm.query(`SELECT count(*) AS n FROM "AuthSession" WHERE "userId"=$1 AND "revokedAt" IS NULL`, [userId])).rows[0].n);
const idDe = async (e: string) => (await adm.query(`SELECT "userId" FROM "AuthIdentity" WHERE email=$1`, [e])).rows[0]?.userId as string;
const caixa: AuthMailPayload[] = [];
const enviar = async (p: AuthMailPayload) => { caixa.push(p); };
const entregar = async (userId: string) => { while ((await deliverNextAuthMail(pool, enviar, userId)) === "sent"); };

// ---- sequestro prévio de conta
delete process.env.AUTH_REQUIRE_EMAIL_VERIFICATION;
const vitima = email("vitima");
await auth.register({ email: vitima, password: SENHA });
const sessaoAtacante = await auth.login({ email: vitima, password: SENHA });
const idVitima = await idDe(vitima);
ok((await sessaoViva(idVitima)) === 1, "o atacante, que cadastrou o e-mail da vítima, entra e tem uma sessão");
const g = await auth.loginWithGoogle({ subject: `g-${R}`, email: vitima, emailVerified: true });
ok(g.linked && g.userId === idVitima, "a vítima entra com o Google e fica com a mesma conta");
ok((await erro(() => auth.login({ email: vitima, password: SENHA }))) === "INVALID_CREDENTIALS", "a senha do atacante deixa de valer");
const restantes = Number((await adm.query(`SELECT count(*) AS n FROM "AuthSession" WHERE "userId"=$1 AND "revokedAt" IS NULL AND "tokenHash" <> (SELECT "tokenHash" FROM "AuthSession" WHERE "userId"=$1 ORDER BY "createdAt" DESC LIMIT 1)`, [idVitima])).rows[0].n);
ok(restantes === 0, "e a sessão que o atacante já tinha é encerrada");
ok(sessaoAtacante.token.length === 43 && (await adm.query(`SELECT 1 FROM "AuditLog" WHERE action='AUTH_GOOGLE_LINKED_PASSWORD_CLEARED' AND "actorId"=$1`, [idVitima])).rowCount === 1, "a limpeza fica registrada na auditoria");

// quem confirmou o e-mail por link não perde a senha ao juntar o Google
process.env.AUTH_REQUIRE_EMAIL_VERIFICATION = "1";
const legit = email("legit");
await auth.register({ email: legit, password: SENHA });
const idLegit = await idDe(legit);
await entregar(idLegit);
await auth.verifyEmail({ token: caixa.find((c) => c.email === legit && c.purpose === "VERIFY_EMAIL")!.token });
await auth.loginWithGoogle({ subject: `g2-${R}`, email: legit, emailVerified: true });
ok((await erro(() => auth.login({ email: legit, password: SENHA }))) === "ok", "quem confirmou o e-mail por link mantém a senha ao juntar o Google");

// ---- confirmação de e-mail (ligada por AUTH_REQUIRE_EMAIL_VERIFICATION=1)
const novo = email("novo");
await auth.register({ email: novo, password: SENHA });
const idNovo = await idDe(novo);
ok((await adm.query(`SELECT "verifiedAt" FROM "AuthIdentity" WHERE "userId"=$1`, [idNovo])).rows[0].verifiedAt === null, "com a confirmação ligada a conta nasce não verificada");
ok((await erro(() => auth.login({ email: novo, password: SENHA }))) === "INVALID_CREDENTIALS", "e não entra antes de confirmar o e-mail");
await entregar(idNovo);
const v1 = caixa.filter((c) => c.email === novo && c.purpose === "VERIFY_EMAIL").at(-1)!;
ok(!!v1 && v1.token.length === 43, "o e-mail de confirmação é entregue pela fila");
await auth.register({ email: novo, password: OUTRA });
await entregar(idNovo);
const v2 = caixa.filter((c) => c.email === novo && c.purpose === "VERIFY_EMAIL").at(-1)!;
ok(v2.token !== v1.token, "cadastrar de novo antes de confirmar manda um link novo");
ok((await erro(() => auth.verifyEmail({ token: v1.token }))) === "TOKEN_INVALID", "e o link antigo deixa de valer");
await auth.verifyEmail({ token: v2.token });
ok((await erro(() => auth.login({ email: novo, password: OUTRA }))) === "ok", "depois de confirmar, entra com a senha do cadastro mais recente");
delete process.env.AUTH_REQUIRE_EMAIL_VERIFICATION;
const livre = email("livre");
await auth.register({ email: livre, password: SENHA });
ok((await auth.login({ email: livre, password: SENHA })).userId === (await idDe(livre)), "sem a variável, a conta nasce verificada como antes");

// ---- recuperação de senha entregue
const idLivre = await idDe(livre);
await auth.requestReset({ email: livre });
await entregar(idLivre);
const rst = caixa.filter((c) => c.email === livre && c.purpose === "RESET_PASSWORD").at(-1)!;
ok(!!rst, "o e-mail de recuperação de senha é entregue pela fila");
await auth.resetPassword({ token: rst.token, password: OUTRA });
ok((await erro(() => auth.login({ email: livre, password: SENHA }))) === "INVALID_CREDENTIALS" && (await erro(() => auth.login({ email: livre, password: OUTRA }))) === "ok", "a senha nova vale e a antiga não");

// ---- bloqueio de login que não trava o dono
const dono = email("dono");
await auth.register({ email: dono, password: SENHA });
const A = { ip: "203.0.113.10" }, B = { ip: "198.51.100.20" };
const codigos: string[] = [];
for (let i = 0; i < 12; i++) codigos.push(await erro(() => auth.login({ email: dono, password: `Errada#${i}aaaa` }, A)));
ok(codigos.includes("RATE_LIMITED"), "o atacante é bloqueado depois de várias senhas erradas");
ok((await erro(() => auth.login({ email: dono, password: SENHA }, A))) === "RATE_LIMITED", "e, de lá, nem a senha certa entra");
ok((await erro(() => auth.login({ email: dono, password: SENHA }, B))) === "ok", "mas o dono, de outra origem, entra normalmente (antes o atacante travava o dono)");
const rajada = email("rajada");
await auth.register({ email: rajada, password: SENHA });
const simult = await Promise.all(Array.from({ length: 30 }, (_, i) => erro(() => auth.login({ email: rajada, password: `Errada#${i}cccc` }, { ip: "203.0.113.99" }))));
ok(simult.filter((c) => c === "INVALID_CREDENTIALS").length <= 10 && simult.includes("RATE_LIMITED"), `30 tentativas simultâneas: no máximo 10 são conferidas, o resto é barrado (${simult.filter((c) => c === "INVALID_CREDENTIALS").length} conferidas)`);
const certas = await Promise.all(Array.from({ length: 5 }, () => erro(() => auth.login({ email: dono, password: SENHA }, { ip: "198.51.100.30" }))));
ok(certas.every((c) => c === "ok"), "logins certos simultâneos não gastam o limite (a reserva é devolvida)");
const outroAlvo = email("alvo2");
await auth.register({ email: outroAlvo, password: SENHA });
const dist: string[] = [];
for (let i = 0; i < 64; i++) dist.push(await erro(() => auth.login({ email: outroAlvo, password: `Errada#${i}bbbb` }, { ip: `192.0.2.${i + 1}` })));
ok(dist.slice(60).includes("RATE_LIMITED"), "um chute vindo de muitas origens ainda bloqueia a conta");
ok((await erro(() => auth.login({ email: dono, password: SENHA }, B))) === "ok", "e o bloqueio de uma conta não afeta as outras (nem o login do site)");

await pool.end(); await adm.end();
console.log("TODOS OS TESTES PASSARAM");
