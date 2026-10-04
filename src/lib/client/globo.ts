/**
 * Globo vivo da identidade visual: pontos na esfera, luzes âmbar de cidades,
 * pessoas ligadas por arcos com pulsos. Canvas 2D puro, sem dependências.
 * Pausa sozinho fora da tela e com a aba em segundo plano.
 */
export type OpcoesGlobo = {
  pontos: number; pessoas: number; arcos: number; escala: number; velocidade: number;
  montagem?: number; deslocamento?: number; giroInicial?: number; malha?: boolean;
};
type V3 = [number, number, number];

const grausParaVetor = (lat: number, lon: number): V3 => {
  const a = (lat * Math.PI) / 180, b = (lon * Math.PI) / 180;
  return [Math.cos(a) * Math.cos(b), Math.sin(a), Math.cos(a) * Math.sin(b)];
};
const angulo = (p: V3, q: V3) => Math.acos(Math.max(-1, Math.min(1, p[0] * q[0] + p[1] * q[1] + p[2] * q[2])));
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const CIDADES: V3[] = [[-23, -46], [-22, -43], [-15, -47], [-30, -51], [-8, -35], [-3, -38], [40, -74], [34, -118], [51, 0], [48, 2], [40, -3], [52, 13], [35, 139], [37, 127], [31, 121], [19, 72], [-33, 151], [30, 31], [6, 3], [55, 37], [-34, -58], [19, -99], [1, 103], [25, 55]].map(([a, b]) => grausParaVetor(a!, b!));

export function criaGlobo(canvas: HTMLCanvasElement, o: OpcoesGlobo): { parar: () => void } {
  const ctx = canvas.getContext("2d");
  if (!ctx) return { parar: () => undefined };
  const reduz = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let W = 0, H = 0, R = 0, CX = 0, CY = 0, vivo = true, ativo = true;

  const pts: { p: V3; amb: boolean; s: number; tw: number; o: V3 }[] = [];
  const ouro = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < o.pontos; i++) {
    const y = 1 - (i / (o.pontos - 1)) * 2, r = Math.sqrt(1 - y * y), t = ouro * i;
    const p: V3 = [Math.cos(t) * r, y, Math.sin(t) * r];
    let d = 9;
    for (const c of CIDADES) d = Math.min(d, angulo(p, c));
    const amb = d < 0.2 + Math.random() * 0.08 && Math.random() < 0.8;
    pts.push({ p, amb, s: amb ? rnd(1.1, 2) : rnd(0.9, 1.5), tw: Math.random() * 6.28, o: [rnd(-3, 3), rnd(-3, 3), rnd(-3, 3)] });
  }
  const pessoas = Array.from({ length: o.pessoas }, (_, i) => {
    const c = CIDADES[i % CIDADES.length]!;
    const p: V3 = [c[0] + rnd(-0.1, 0.1), c[1] + rnd(-0.1, 0.1), c[2] + rnd(-0.1, 0.1)];
    const l = Math.hypot(...p);
    return { p: [p[0] / l, p[1] / l, p[2] / l] as V3, lig: [] as number[] };
  });
  pessoas.forEach((a, i) => pessoas.map((b, j) => [j, angulo(a.p, b.p)] as const).filter(([j]) => j !== i)
    .sort((x, y) => x[1] - y[1]).slice(0, 2).forEach(([j]) => { if (!a.lig.includes(j)) a.lig.push(j); }));
  const arcos: { i: number; j: number; t: number; v: number }[] = [];
  while (arcos.length < o.arcos) {
    const i = Math.floor(Math.random() * pessoas.length), j = Math.floor(Math.random() * pessoas.length);
    if (i !== j && angulo(pessoas[i]!.p, pessoas[j]!.p) > 0.6) arcos.push({ i, j, t: Math.random(), v: rnd(0.003, 0.006) });
  }
  const malha: V3[] = [], malhaLig: [number, number][] = [];
  if (o.malha) {
    for (let i = 0; i < 60; i++) { const u = rnd(-1, 1), th = rnd(0, 6.28), r = Math.sqrt(1 - u * u); malha.push([Math.cos(th) * r, u, Math.sin(th) * r]); }
    malha.forEach((a, i) => malha.map((b, j) => [j, angulo(a, b)] as const).filter(([j, d]) => j > i && d < 0.75)
      .sort((x, y) => x[1] - y[1]).slice(0, 3).forEach(([j]) => malhaLig.push([i, j])));
  }

  let giro = o.giroInicial ?? -1.1;
  const incl = 0.34, t0 = performance.now();
  const tamanho = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2), r = canvas.getBoundingClientRect();
    W = r.width; H = r.height; canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    R = Math.min(W, H) * o.escala; CX = W / 2; CY = H / 2 + (o.deslocamento ?? 0) * H;
  };
  tamanho();
  // ResizeObserver (não só "resize" da janela): em layouts flex/grid o canvas pode medir 0x0
  // no primeiro paint, antes do contêiner esticar — sem isso o globo fica permanentemente
  // invisível até a janela ser redimensionada manualmente.
  const ro = new ResizeObserver(() => tamanho());
  ro.observe(canvas);
  window.addEventListener("resize", tamanho);
  const obs = new IntersectionObserver((es) => { ativo = es[0]?.isIntersecting ?? true; });
  obs.observe(canvas);
  const pj = (v: V3, raio = R, g = giro): V3 => {
    const c = Math.cos(g), s = Math.sin(g), cp = Math.cos(incl), sp = Math.sin(incl);
    const x = v[0] * c - v[2] * s, z = v[0] * s + v[2] * c, y2 = v[1] * cp - z * sp, z2 = v[1] * sp + z * cp, f = 1 + z2 * 0.1;
    return [CX + x * raio * f, CY - y2 * raio * f, z2];
  };

  const quadro = (agora: number) => {
    if (!vivo) return;
    if (!ativo || document.hidden) { requestAnimationFrame(quadro); return; }
    const t = Math.max(0, (agora - t0) / 1000);
    const m = reduz || !o.montagem ? 1 : 1 - Math.pow(1 - Math.min(1, t / o.montagem), 4);
    if (!reduz) giro += o.velocidade;
    ctx.clearRect(0, 0, W, H);
    const halo = ctx.createRadialGradient(CX, CY, R * 0.9, CX, CY, R * 1.55);
    halo.addColorStop(0, "rgba(76,141,255,.26)"); halo.addColorStop(0.35, "rgba(76,141,255,.08)"); halo.addColorStop(1, "rgba(76,141,255,0)");
    ctx.globalAlpha = m; ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(CX, CY, R * 1.55, 0, 7); ctx.fill();
    const disco = ctx.createRadialGradient(CX - R * 0.35, CY - R * 0.4, R * 0.1, CX, CY, R);
    disco.addColorStop(0, "#0D2756"); disco.addColorStop(0.7, "#071734"); disco.addColorStop(1, "#040C1E");
    ctx.fillStyle = disco; ctx.beginPath(); ctx.arc(CX, CY, R, 0, 7); ctx.fill();
    ctx.strokeStyle = "rgba(127,178,255,.6)"; ctx.lineWidth = 1.2; ctx.shadowColor = "#4C8DFF"; ctx.shadowBlur = 22;
    ctx.beginPath(); ctx.arc(CX, CY, R, 0, 7); ctx.stroke(); ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    if (o.malha) {
      const mp = malha.map((v) => pj(v, R * 1.32 * (1 + (1 - m) * 0.5), -giro * 0.6 + 1));
      ctx.lineWidth = 0.7;
      for (const [i, j] of malhaLig) { const a = mp[i]!, b = mp[j]!; ctx.strokeStyle = `rgba(127,178,255,${(0.05 + ((a[2] + b[2]) / 2 + 1) * 0.07) * m})`; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
    }
    for (const q of pts) {
      const v: V3 = m < 1 ? [q.p[0] + q.o[0] * (1 - m), q.p[1] + q.o[1] * (1 - m), q.p[2] + q.o[2] * (1 - m)] : q.p;
      const [x, y, z] = pj(v);
      if (z < -0.1 && m > 0.95) continue;
      const luz = Math.max(0, z);
      if (q.amb) { const tw = 0.6 + 0.4 * Math.sin(t * 1.7 + q.tw); ctx.fillStyle = `rgba(255,${172 + Math.floor(tw * 40)},80,${(0.35 + luz * 0.65) * tw})`; }
      else ctx.fillStyle = `rgba(127,178,255,${0.1 + luz * 0.5})`;
      ctx.fillRect(x, y, q.s, q.s);
    }
    const pp = pessoas.map((p) => pj(p.p));
    ctx.lineWidth = 0.9;
    pessoas.forEach((a, i) => a.lig.forEach((j) => { const A = pp[i]!, B = pp[j]!; if (A[2] < 0 || B[2] < 0) return; ctx.strokeStyle = `rgba(127,178,255,${0.2 * m})`; ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke(); }));
    for (const a of arcos) {
      const P = pessoas[a.i]!.p, Q = pessoas[a.j]!.p, mm: V3 = [P[0] + Q[0], P[1] + Q[1], P[2] + Q[2]], ml = Math.hypot(...mm), alt = 1 + angulo(P, Q) * 0.3;
      const A = pj(P), B = pj(Q), C = pj([(mm[0] / ml) * alt, (mm[1] / ml) * alt, (mm[2] / ml) * alt]);
      const vis = Math.max(0, Math.min(1, Math.min(A[2], B[2]) * 4));
      if (vis <= 0) continue;
      const qx = 2 * C[0] - (A[0] + B[0]) / 2, qy = 2 * C[1] - (A[1] + B[1]) / 2;
      ctx.strokeStyle = `rgba(76,141,255,${0.45 * vis * m})`; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.quadraticCurveTo(qx, qy, B[0], B[1]); ctx.stroke();
      if (!reduz) a.t = (a.t + a.v) % 1;
      const u = a.t, x = (1 - u) ** 2 * A[0] + 2 * (1 - u) * u * qx + u * u * B[0], y = (1 - u) ** 2 * A[1] + 2 * (1 - u) * u * qy + u * u * B[1];
      ctx.shadowColor = "#7FB2FF"; ctx.shadowBlur = 14; ctx.fillStyle = `rgba(235,245,255,${vis * m})`; ctx.beginPath(); ctx.arc(x, y, 2.2, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
    }
    for (const A of pp) {
      if (A[2] < 0.05) continue;
      ctx.shadowColor = "#FFA834"; ctx.shadowBlur = 10; ctx.fillStyle = `rgba(255,190,100,${0.55 + A[2] * 0.45})`;
      ctx.beginPath(); ctx.arc(A[0], A[1], 2.8 * m, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
    }
    requestAnimationFrame(quadro);
  };
  requestAnimationFrame(quadro);
  return { parar: () => { vivo = false; obs.disconnect(); ro.disconnect(); window.removeEventListener("resize", tamanho); } };
}
