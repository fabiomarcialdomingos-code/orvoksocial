/* eslint-disable @typescript-eslint/no-explicit-any */
// Simulação de 30 usuários. Modos (SIM_MODO): "tudo" (padrão), "simular" ou "limpar".
//   simular → salva o retrato do banco, roda as fases e grava bruto.json; NÃO apaga nada.
//   limpar  → apaga tudo da simulação, confere o banco contra o retrato e grava o relatório final.
import { config as loadEnv } from "dotenv";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { Ator, BASE, RUN, SENHA, achados, conectarBanco, contagens, fase, http, requisicoes, resultados, verificar } from "./nucleo";
import { autenticacaoEmProfundidade } from "./fases-auth";
import { contas, contasESenhas, preparar, segurancaAnonima } from "./fases-base";
import { carga, concorrencia, iniciarMonitor, monitor } from "./fases-carga";
import { autorizacaoCruzada, estante, mundo, retrato, socialEDados } from "./fases-produto";
import { limpar } from "./limpeza";
import { analisarLog, relatorioMarkdown } from "./relatorio";

loadEnv({ path: ".env.local", override: false, quiet: true } as any);
const saida = process.env.SIM_SAIDA ?? "/tmp/sim_out";
const modo = process.env.SIM_MODO ?? "tudo";
mkdirSync(saida, { recursive: true });
const db = conectarBanco();
if (!db) throw new Error("Defina SIM_DATABASE_URL (dono do banco) para preparar e limpar.");

const estado: any = { run: RUN, base: BASE, inicio: Date.now(), fim: Date.now(), antes: {} };
if (modo !== "limpar") {
  estado.antes = await contagens(db);
  writeFileSync(`${saida}/antes.json`, JSON.stringify({ run: RUN, inicio: estado.inicio, antes: estado.antes }));
  const pararMonitor = iniciarMonitor(db);
  console.log(`Simulação ${RUN} contra ${BASE}`);
  try {
    const { eventoId, opcoes } = await preparar(db);
    await segurancaAnonima();
    await contasESenhas(db);
    await autenticacaoEmProfundidade();
    await retrato();
    await mundo(db, eventoId, opcoes);
    const admin = process.env.SIM_ADMIN_EMAIL && process.env.SIM_ADMIN_SENHA ? new Ator("admin", "conta") : null;
    if (admin) { const r = await http(admin, "POST", "/api/v1/auth/login", { corpo: { email: process.env.SIM_ADMIN_EMAIL, password: process.env.SIM_ADMIN_SENHA } }); if (r.status !== 200) { verificar("o administrador de teste entra", false, `status ${r.status}`); } }
    await estante();
    await socialEDados(admin && admin.jar.size ? admin : null);
    await autorizacaoCruzada();
    if (admin?.jar.size) await http(admin, "POST", "/api/v1/auth/logout");
    await concorrencia(db);
    await carga();
  } catch (e) { achados.push({ sev: "alto", fase: "execução", titulo: "A simulação parou por erro", detalhe: String((e as Error).stack ?? e).slice(0, 700) }); console.error(e); }
  pararMonitor();
  estado.fim = Date.now();
  writeFileSync(`${saida}/bruto.json`, JSON.stringify({ ...estado, resultados, achados, requisicoes, monitor }, null, 1));
  console.log(`\n${resultados.filter((r) => r.ok).length} verificações ok, ${resultados.filter((r) => !r.ok).length} falhas, ${achados.length} achados, ${requisicoes.length} requisições`);
}

let limpeza: Awaited<ReturnType<typeof limpar>> | null = null;
if (modo !== "simular") {
  const carregado = existsSync(`${saida}/bruto.json`) ? JSON.parse(readFileSync(`${saida}/bruto.json`, "utf8")) : null;
  const ant = modo === "limpar" ? (existsSync(`${saida}/antes.json`) ? JSON.parse(readFileSync(`${saida}/antes.json`, "utf8")) : { antes: {}, inicio: Date.now() }) : { antes: estado.antes, inicio: estado.inicio };
  fase("11. Limpeza");
  limpeza = await limpar(db, ant.antes, ant.inicio);
  console.log(JSON.stringify({ apagado: limpeza.apagado, diferencas: limpeza.diferencas, pendencias: limpeza.pendencias }, null, 1));
  const base = modo === "limpar" ? carregado : { ...estado, resultados, achados, requisicoes, monitor };
  if (base) {
    const md = relatorioMarkdown({ run: base.run, base: base.base, inicio: base.inicio, fim: base.fim, resultados: base.resultados, achados: base.achados, requisicoes: base.requisicoes, monitor: base.monitor ?? [], log: analisarLog(process.env.SIM_LOG_SERVIDOR), limpeza, antes: ant.antes });
    writeFileSync(`${saida}/relatorio.md`, md);
    writeFileSync(`${saida}/limpeza.json`, JSON.stringify(limpeza, null, 1));
    console.log(`\nRelatório gravado em ${saida}/relatorio.md`);
  }
}
void SENHA; void contas;
await db.end();
