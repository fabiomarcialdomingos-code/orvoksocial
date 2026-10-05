/**
 * Filtro de SVG. O desenho vem de um modelo de linguagem e SVG pode carregar código (script,
 * eventos, links, estilos). Por isso o que o modelo escreve NUNCA é usado como veio: o texto é lido
 * por uma lista permitida de formas e atributos e o SVG é reconstruído do zero.
 *
 *  - Tag fora da lista (script, style, image, use, text, foreignObject, animação…): o desenho inteiro é recusado.
 *  - Atributo fora da lista (on*, href, style, class, id…): é descartado e nunca chega à saída.
 *  - Valores só com caracteres seguros (números, comandos de caminho, none/currentColor).
 *  - A "moldura" (viewBox, traço, cor) é fixa e escrita por nós; o modelo só desenha as formas.
 *  - Texto solto, comentário, CDATA, doctype e entidades são recusados.
 */
export const MOLDURA_ABERTURA =
  '<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">';
const LIMITE_BYTES = 8_000, LIMITE_ELEMENTOS = 60, LIMITE_PROFUNDIDADE = 4;

const NUM = String.raw`-?\d{1,4}(?:\.\d{1,3})?`;
const reNumero = new RegExp(`^${NUM}$`);
const reLista = new RegExp(`^(?:${NUM}[\\s,]+)*${NUM}$`);
const reCaminho = /^[MmLlHhVvCcSsQqTtAaZz0-9eE+\-.,\s]{1,1800}$/;
const reTransform = new RegExp(`^(?:(?:translate|rotate|scale)\\(\\s*${NUM}(?:[\\s,]+${NUM}){0,2}\\s*\\)\\s*){1,3}$`);

const numero = (v: string) => reNumero.test(v);
const entre = (min: number, max: number) => (v: string) => numero(v) && Number(v) >= min && Number(v) <= max;
const cor = (v: string) => v === "none" || v === "currentColor";
const enumDe = (...o: string[]) => (v: string) => o.includes(v);

/** Atributos de estilo que qualquer forma pode ter. */
const ESTILO: Record<string, (v: string) => boolean> = {
  fill: cor, stroke: cor, "fill-opacity": entre(0, 1), "stroke-opacity": entre(0, 1), opacity: entre(0, 1),
  "stroke-width": entre(0.5, 6), "stroke-linecap": enumDe("round", "butt", "square"), "stroke-linejoin": enumDe("round", "miter", "bevel"),
  "stroke-dasharray": (v) => reLista.test(v), transform: (v) => reTransform.test(v),
};
const FORMAS: Record<string, Record<string, (v: string) => boolean>> = {
  g: {},
  path: { d: (v) => reCaminho.test(v) },
  circle: { cx: numero, cy: numero, r: entre(0, 120) },
  ellipse: { cx: numero, cy: numero, rx: entre(0, 120), ry: entre(0, 120) },
  rect: { x: numero, y: numero, width: entre(0, 240), height: entre(0, 240), rx: entre(0, 120), ry: entre(0, 120) },
  line: { x1: numero, y1: numero, x2: numero, y2: numero },
  polyline: { points: (v) => reLista.test(v) },
  polygon: { points: (v) => reLista.test(v) },
};

const reEspaco = /\s+/y;
const reTag = /<(\/?)([A-Za-z][A-Za-z0-9]*)((?:\s+[A-Za-z][A-Za-z0-9:-]*\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/y;
const reAttr = /\s+([A-Za-z][A-Za-z0-9:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/y;

/** Devolve o SVG reconstruído e seguro, ou null se o texto não puder ser aproveitado. */
export function sanitizarSvg(bruto: string): string | null {
  if (typeof bruto !== "string" || bruto.length === 0 || Buffer.byteLength(bruto) > LIMITE_BYTES * 2) return null;
  const achado = bruto.match(/<svg\b[^>]*>([\s\S]*?)<\/svg\s*>/i);
  if (!achado) return null;
  const corpo = achado[1]!;
  if (/[&]|<!|<\?/.test(corpo)) return null; // entidades, comentário, CDATA, doctype, instrução

  const saida: string[] = [];
  const pilha: string[] = [];
  let elementos = 0, pos = 0;
  while (pos < corpo.length) {
    reEspaco.lastIndex = pos;
    const esp = reEspaco.exec(corpo);
    if (esp) { pos += esp[0].length; continue; }
    reTag.lastIndex = pos;
    const t = reTag.exec(corpo);
    if (!t) return null; // texto solto ou tag malformada
    pos += t[0].length;
    const fechando = t[1] === "/", nome = t[2]!.toLowerCase(), atributos = t[3] ?? "", autoFecha = t[4] === "/";
    if (!(nome in FORMAS)) return null; // qualquer outra tag recusa o desenho inteiro
    if (fechando) {
      if (atributos.trim() !== "" || autoFecha || pilha.pop() !== nome) return null;
      saida.push(`</${nome}>`);
      continue;
    }
    if (++elementos > LIMITE_ELEMENTOS || pilha.length >= LIMITE_PROFUNDIDADE) return null;
    const permitidos = { ...ESTILO, ...FORMAS[nome]! };
    const mantidos: string[] = [];
    let ap = 0;
    while (ap < atributos.length) {
      reAttr.lastIndex = ap;
      const a = reAttr.exec(atributos);
      if (!a) return null;
      ap += a[0].length;
      const chave = a[1]!, valor = (a[2] ?? a[3] ?? "").trim();
      const valida = Object.prototype.hasOwnProperty.call(permitidos, chave) ? permitidos[chave] : undefined;
      if (valida?.(valor)) mantidos.push(`${chave}="${valor}"`); // atributo desconhecido ou valor estranho: descartado
    }
    if (nome === "g") {
      if (autoFecha) continue; // grupo vazio não desenha nada
      pilha.push(nome);
      saida.push(`<g${mantidos.length ? " " + mantidos.join(" ") : ""}>`);
    } else {
      if (!autoFecha) pilha.push(nome);
      saida.push(`<${nome}${mantidos.length ? " " + mantidos.join(" ") : ""}${autoFecha ? "/" : ""}>`);
    }
  }
  if (pilha.length !== 0 || saida.length === 0) return null; // sem nada desenhado, não vale
  const svg = `${MOLDURA_ABERTURA}${saida.join("")}</svg>`;
  return Buffer.byteLength(svg) <= LIMITE_BYTES ? svg : null;
}

/** Desenho de reserva (um quadro vazio) enquanto o desenho do objeto não existe. */
export const ILUSTRACAO_PADRAO =
  `${MOLDURA_ABERTURA}<rect x="26" y="26" width="68" height="68" rx="6" stroke-dasharray="3 5" opacity="0.6"/><circle cx="60" cy="60" r="9" fill="currentColor" fill-opacity="0.2"/></svg>`;

/** Chave de reaproveitamento: o mesmo nome (sem acento, caixa ou espaços extras) dá o mesmo desenho. */
export function normalizarObjeto(titulo: string): string {
  return titulo.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}
