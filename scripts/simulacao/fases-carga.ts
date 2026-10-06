// Fases 9 e 10: concorrência (corridas) e carga com os 30 usuários ao mesmo tempo. Também o monitor do banco.
import { execFileSync } from "node:child_process";
import type { Pool } from "pg";
import { AVISO_IDADE, AVISO_RETRATO_VERSAO } from "@/lib/desafio/catalogo";
import { Ator, RUN, SENHA, achado, dormir, emailDe, fase, http, nomeDe, verificar } from "./nucleo";
import { contas, convidados, todos } from "./fases-base";
import { desafios, pares } from "./fases-produto";

export type Amostra = { t: number; conexoes: number; ativas: number; commits: number; rollbacks: number; deadlocks: number; tempFiles: number; rssMb?: number; cpu?: number };
export const monitor: Amostra[] = [];

/** A cada 2 s: conexões e contadores do banco (e do servidor, se for local). */
export function iniciarMonitor(db: Pool): () => void {
  const pid = process.env.SIM_SERVER_PID;
  const t = setInterval(async () => {
    try {
      const r = (await db.query(`SELECT (SELECT count(*)::int FROM pg_stat_activity WHERE datname=current_database()) AS conexoes,
        (SELECT count(*)::int FROM pg_stat_activity WHERE datname=current_database() AND state='active') AS ativas,
        xact_commit::bigint AS commits, xact_rollback::bigint AS rollbacks, deadlocks::bigint AS deadlocks, temp_files::bigint AS "tempFiles" FROM pg_stat_database WHERE datname=current_database()`)).rows[0];
      const a: Amostra = { t: Date.now(), conexoes: r.conexoes, ativas: r.ativas, commits: Number(r.commits), rollbacks: Number(r.rollbacks), deadlocks: Number(r.deadlocks), tempFiles: Number(r.tempFiles) };
      if (pid) { try { const [rss, cpu] = execFileSync("ps", ["-o", "rss=,pcpu=", "-p", pid], { encoding: "utf8" }).trim().split(/\s+/); a.rssMb = Math.round(Number(rss) / 1024); a.cpu = Number(cpu); } catch { /* servidor fora */ } }
      monitor.push(a);
    } catch { /* o monitor nunca derruba a simulação */ }
  }, 2000);
  return () => clearInterval(t);
}

const paralelo = <T>(n: number, f: (i: number) => Promise<T>) => Promise.all(Array.from({ length: n }, (_, i) => f(i)));

/** Fase 9: corridas. Muita gente fazendo a mesma coisa ao mesmo tempo. */
export async function concorrencia(db: Pool): Promise<void> {
  fase("9. Concorrência (corridas)");
  // 20 cadastros ao mesmo tempo do mesmo e-mail
  const email = emailDe(91);
  const reg = await paralelo(20, () => http(new Ator("corrida", "anon"), "POST", "/api/v1/auth/register", { corpo: { email, password: SENHA } }));
  const n = Number((await db.query(`SELECT count(*) AS n FROM "AuthIdentity" WHERE email=$1`, [email])).rows[0].n);
  verificar("20 cadastros simultâneos do mesmo e-mail criam uma conta só", n === 1, `${n} contas criadas`);
  verificar("e nenhum deles dá erro 500", reg.every((r) => r.status < 500), reg.map((r) => r.status).join(","));
  verificar("o limite de cadastros por e-mail segura o excesso (429)", reg.some((r) => r.status === 429), `${reg.filter((r) => r.status === 429).length} bloqueados`);

  // 15 convidados respondendo ao mesmo convite ao mesmo tempo
  const alvo = desafios[5]!;
  const resp = await paralelo(15, (i) => http(new Ator(nomeDe(40 + i), "convidado"), "POST", `/api/v1/desafio/${alvo.codigo}/tentativa`, { corpo: { nome: nomeDe(40 + i), previsoes: Array.from({ length: 12 }, (_, k) => "ABCD"[(i + k) % 4]), avisoRetrato: AVISO_RETRATO_VERSAO, consentimentoIdade: { aceito: true, versao: AVISO_IDADE.versao, hash: AVISO_IDADE.hash } } }));
  const aceitas = resp.filter((r) => r.status < 300).length;
  const gravadas = Number((await db.query(`SELECT count(*) AS n FROM "GuestChallengeAttempt" a JOIN "GuestChallenge" c ON c.id=a."challengeId" WHERE c.code=$1 AND a."predictorName" = ANY($2)`, [alvo.codigo, Array.from({ length: 15 }, (_, i) => nomeDe(40 + i))])).rows[0].n);
  verificar("15 respostas simultâneas ao mesmo convite: tudo que foi aceito foi gravado", aceitas === gravadas, `aceitas ${aceitas}, gravadas ${gravadas}`);
  verificar("e sem erro 500", resp.every((r) => r.status < 500), resp.map((r) => r.status).join(","));

  // 30 tentativas de login errado em paralelo contra uma conta
  const ataque = await paralelo(30, () => http(new Ator("ataque", "anon"), "POST", "/api/v1/auth/login", { corpo: { email: contas[16]!.email, password: "Errada#99999a" } }));
  verificar("30 tentativas de senha simultâneas contra uma conta: o limite aguenta (sem 500, com 429)", ataque.every((r) => r.status < 500) && ataque.some((r) => r.status === 429), ataque.map((r) => r.status).join(","));
  const certa = await http(new Ator("dono", "anon"), "POST", "/api/v1/auth/login", { corpo: { email: contas[16]!.email, password: SENHA } });
  if (certa.status === 429) achado("medio", "Qualquer pessoa pode travar o login de outra conta", "Poucas tentativas com senha errada bloqueiam por 15 minutos até a senha certa. Quem sabe o e-mail de alguém consegue impedir que ela entre. O limite por conta é útil contra adivinhação, mas combinado com um limite global (1000 tentativas/15 min para o site todo) também permite bloquear o login do site inteiro com poucas requisições.");

  // propostas simultâneas de conversa na mesma rodada
  const p = pares[2]!;
  const props = await Promise.all([...Array.from({ length: 5 }, () => http(p.conv, "POST", `/api/v1/mundo/rodadas/${p.codigo}/conversa`, { corpo: { acao: "propor" } })), ...Array.from({ length: 5 }, () => http(p.dono, "POST", `/api/v1/mundo/rodadas/${p.codigo}/conversa`, { corpo: { acao: "propor" } }))]);
  const fios = Number((await db.query(`SELECT count(*) AS n FROM "RoundThread" t JOIN "WorldRound" w ON w.id=t."roundId" WHERE w.code=$1`, [p.codigo])).rows[0].n);
  verificar("10 propostas de conversa simultâneas criam uma conversa só", fios <= 1 && props.every((r) => r.status < 500), `${fios} conversa(s); ${props.map((r) => r.status).join(",")}`);
}

/** Fase 10: os 30 usuários usando o site ao mesmo tempo. */
export async function carga(): Promise<void> {
  fase("10. Carga: 30 usuários ao mesmo tempo");
  const rotasConta = ["/api/v1/users/me", "/api/v1/notifications", "/api/v1/desafio/retrato", "/api/v1/mundo/conexoes", "/api/v1/desafio/meus", "/api/v1/auth/session"];
  const rotasPublicas = ["/", "/api/v1/desafio/catalogo?rel=amigos", "/api/health", "/privacidade"];
  const inicio = performance.now(); let total = 0;
  await Promise.all(todos().map(async (a, i) => {
    for (let k = 0; k < 14; k++) {
      const rota = a.tipo === "conta" && k % 3 !== 0 ? rotasConta[(i + k) % rotasConta.length]! : rotasPublicas[(i + k) % rotasPublicas.length]!;
      await http(a, "GET", rota); total++;
      await dormir(40 + ((i * 7 + k * 13) % 80));
    }
  }));
  const seg = (performance.now() - inicio) / 1000;
  verificar(`${total} requisições dos 30 usuários concluídas em ${seg.toFixed(1)} s`, total >= 400, `${total} requisições`);
  void convidados; void RUN;
}
