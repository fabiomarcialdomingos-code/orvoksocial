/* eslint-disable @typescript-eslint/no-explicit-any */
import { existsSync, readFileSync } from "node:fs";
import type { Amostra } from "./fases-carga";
import type { ResultadoLimpeza } from "./limpeza";
import { pct } from "./nucleo";
import type { Req, Resultado, Sev } from "./nucleo";

const ORDEM: Sev[] = ["critico", "alto", "medio", "baixo", "info"];
const ROTULO: Record<Sev, string> = { critico: "Crítico", alto: "Alto", medio: "Médio", baixo: "Baixo", info: "Informativo" };

/** Lê o log do servidor (ou o log de execução da Vercel, se foi baixado) e conta o que importa. */
export function analisarLog(caminho: string | undefined): { linhas: number; erros: { evento: string; n: number }[]; avisos: number; stacks: string[]; amostra: string[] } | null {
  if (!caminho || !existsSync(caminho)) return null;
  const linhas = readFileSync(caminho, "utf8").split("\n").filter(Boolean);
  const eventos = new Map<string, number>(); const stacks: string[] = []; let avisos = 0; const amostra: string[] = [];
  for (const l of linhas) {
    let j: any = null; try { j = JSON.parse(l); } catch { j = null; }
    if (j?.level === "error") { const k = String(j.event ?? "erro_sem_nome") + (j.errorName ? ` (${j.errorName})` : "") + (j.pgCode ? ` pg=${j.pgCode}` : ""); eventos.set(k, (eventos.get(k) ?? 0) + 1); if (amostra.length < 8) amostra.push(l.slice(0, 200)); }
    else if (j?.level === "warn") avisos++;
    else if (/^\s+at .*:\d+:\d+\)?$/.test(l) || /(TypeError|ReferenceError|RangeError|UnhandledPromiseRejection|ECONNRESET|ECONNREFUSED)/.test(l)) { if (stacks.length < 8) stacks.push(l.slice(0, 200)); }
  }
  return { linhas: linhas.length, erros: [...eventos].map(([evento, n]) => ({ evento, n })).sort((a, b) => b.n - a.n), avisos, stacks, amostra };
}

export function relatorioMarkdown(d: { run: string; base: string; inicio: number; fim: number; resultados: Resultado[]; achados: { sev: Sev; fase: string; titulo: string; detalhe: string }[]; requisicoes: Req[]; monitor: Amostra[]; log: ReturnType<typeof analisarLog>; limpeza: ResultadoLimpeza | null; antes: Record<string, number> }): string {
  const ok = d.resultados.filter((r) => r.ok).length, falhas = d.resultados.filter((r) => !r.ok);
  const por = (f: (r: Req) => string) => { const m = new Map<string, Req[]>(); for (const r of d.requisicoes) { const k = f(r); m.set(k, [...(m.get(k) ?? []), r]); } return m; };
  const seg = (d.fim - d.inicio) / 1000;
  const L: string[] = [];
  L.push(`# Relatório da simulação de 30 usuários`, ``, `Execução \`${d.run}\` contra \`${d.base}\` em ${new Date(d.inicio).toISOString()} (duração ${seg.toFixed(0)} s).`, ``);
  L.push(`## Resumo`, ``, `- **${ok} verificações passaram** e **${falhas.length} falharam**, de ${d.resultados.length}.`, `- **${d.requisicoes.length} requisições** feitas por 30 usuários fictícios (18 com conta, 12 convidados sem cadastro) mais um visitante anônimo.`);
  const cont = (s: Sev) => d.achados.filter((a) => a.sev === s).length;
  L.push(`- **Achados:** ${ORDEM.map((s) => `${cont(s)} ${ROTULO[s].toLowerCase()}`).join(", ")}.`);
  const erros5 = d.requisicoes.filter((r) => r.s >= 500 || r.s === 0);
  L.push(`- **Erros do servidor (5xx ou sem resposta):** ${erros5.length}${erros5.length ? ` (${[...new Set(erros5.map((r) => `${r.m} ${r.p} → ${r.s || "sem resposta"}`))].slice(0, 6).join("; ")})` : ""}.`, ``);
  L.push(`## Achados`, ``);
  for (const s of ORDEM) for (const a of d.achados.filter((x) => x.sev === s)) L.push(`### [${ROTULO[s]}] ${a.titulo}`, `*Fase: ${a.fase}*`, ``, a.detalhe, ``);
  if (!d.achados.length) L.push(`Nenhum achado.`, ``);
  L.push(`## Verificações por fase`, ``, `| Fase | Passaram | Falharam |`, `|---|---|---|`);
  const fases = [...new Set(d.resultados.map((r) => r.fase))];
  for (const f of fases) L.push(`| ${f} | ${d.resultados.filter((r) => r.fase === f && r.ok).length} | ${d.resultados.filter((r) => r.fase === f && !r.ok).length} |`);
  L.push(``);
  if (falhas.length) { L.push(`### Verificações que falharam`, ``); for (const f of falhas) L.push(`- **${f.fase}** — ${f.nome}${f.detalhe ? ` _(${f.detalhe.slice(0, 160)})_` : ""}`); L.push(``); }
  // desempenho
  const todasMs = d.requisicoes.filter((r) => r.s > 0).map((r) => r.ms);
  const carga = d.requisicoes.filter((r) => r.f.startsWith("10.") && r.s > 0);
  L.push(`## Desempenho`, ``, `Todas as requisições: p50 **${Math.round(pct(todasMs, 50))} ms**, p95 **${Math.round(pct(todasMs, 95))} ms**, p99 **${Math.round(pct(todasMs, 99))} ms**, máximo ${Math.round(Math.max(0, ...todasMs))} ms.`);
  if (carga.length) L.push(``, `Durante a carga dos 30 usuários simultâneos (${carga.length} requisições): p50 **${Math.round(pct(carga.map((r) => r.ms), 50))} ms**, p95 **${Math.round(pct(carga.map((r) => r.ms), 95))} ms**, p99 **${Math.round(pct(carga.map((r) => r.ms), 99))} ms**; erros 5xx: **${carga.filter((r) => r.s >= 500).length}**.`);
  L.push(``, `| Rota | Chamadas | p50 | p95 | Erros 5xx |`, `|---|---|---|---|---|`);
  const rotas = [...por((r) => `${r.m} ${r.p}`)].map(([k, v]) => ({ k, n: v.length, p50: pct(v.map((r) => r.ms), 50), p95: pct(v.map((r) => r.ms), 95), e: v.filter((r) => r.s >= 500).length })).sort((a, b) => b.p95 - a.p95).slice(0, 14);
  for (const r of rotas) L.push(`| ${r.k} | ${r.n} | ${Math.round(r.p50)} ms | ${Math.round(r.p95)} ms | ${r.e} |`);
  L.push(``);
  const codigos = new Map<number, number>(); for (const r of d.requisicoes) codigos.set(r.s, (codigos.get(r.s) ?? 0) + 1);
  L.push(`Códigos de resposta: ${[...codigos].sort((a, b) => a[0] - b[0]).map(([c, n]) => `${c || "sem resposta"}: ${n}`).join(" · ")}.`, ``);
  // monitor
  if (d.monitor.length) {
    const m = d.monitor, mx = (f: (a: Amostra) => number) => Math.max(...m.map(f));
    L.push(`## Monitoramento durante a execução`, ``, `${m.length} amostras (a cada 2 s).`, ``, `- Conexões abertas ao banco: máximo **${mx((a) => a.conexoes)}** (consultas ativas ao mesmo tempo: máximo ${mx((a) => a.ativas)}).`);
    const dC = m[m.length - 1]!.commits - m[0]!.commits, dR = m[m.length - 1]!.rollbacks - m[0]!.rollbacks;
    L.push(`- Transações no período: ${dC} confirmadas, **${dR} desfeitas** (rollback); deadlocks: **${m[m.length - 1]!.deadlocks - m[0]!.deadlocks}**; arquivos temporários: ${m[m.length - 1]!.tempFiles - m[0]!.tempFiles}.`);
    if (m.some((a) => a.rssMb !== undefined)) L.push(`- Servidor: memória máxima **${mx((a) => a.rssMb ?? 0)} MB**, CPU máxima ${mx((a) => a.cpu ?? 0)}%.`);
    L.push(``);
  }
  // logs
  L.push(`## Análise dos logs do servidor`, ``);
  if (!d.log) L.push(`Os logs do servidor não estavam disponíveis para esta execução.`, ``);
  else {
    L.push(`${d.log.linhas} linhas analisadas. Eventos de erro registrados: **${d.log.erros.reduce((s, e) => s + e.n, 0)}**; avisos: ${d.log.avisos}; trechos com stack trace ou exceção: ${d.log.stacks.length}.`, ``);
    if (d.log.erros.length) { L.push(`| Evento de erro | Ocorrências |`, `|---|---|`); for (const e of d.log.erros) L.push(`| ${e.evento} | ${e.n} |`); L.push(``); }
    if (d.log.stacks.length) { L.push(`Trechos suspeitos:`, ...d.log.stacks.map((s) => `- \`${s.replace(/`/g, "'")}\``), ``); }
  }
  // limpeza
  if (d.limpeza) {
    const l = d.limpeza;
    L.push(`## Limpeza`, ``, `Linhas apagadas: ${Object.entries(l.apagado).filter(([, n]) => n > 0).map(([k, n]) => `${k}: ${n}`).join("; ") || "nenhuma"}.`, ``);
    L.push(l.diferencas.length ? `**Tabelas com contagem diferente do início:**` : `**O banco voltou exatamente à contagem de linhas de antes da simulação, em todas as tabelas.**`, ``);
    for (const x of l.diferencas) L.push(`- ${x.tabela}: antes ${x.antes}, depois ${x.depois}`);
    if (l.pendencias.length) L.push(``, `Pendências da limpeza:`, ...l.pendencias.map((p) => `- ${p}`));
    if (l.residuos.length) L.push(``, `Resíduos esperados:`, ...l.residuos.map((p) => `- ${p}`));
    L.push(``);
  }
  return L.join("\n");
}
