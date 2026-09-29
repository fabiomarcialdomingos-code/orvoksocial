"use client";
import { useEffect, useMemo, useState } from "react";
import { Globo } from "./Globo";
import { Anel, Icone, LOGIN_GOOGLE, Inicial, Moldura, Radar, enviarJson, estilos as s } from "./pecas";

type Pergunta = { chave: string; texto: string; opcoes: string[] };
type Aviso = { versao: string; hash: string; texto: string };
type Tela = "nome" | "pergunta" | "pronto" | "convite" | "enviado";
const LETRAS = ["A", "B", "C", "D"] as const;
const TOTAL = 10;

const TONS: [string, (amigo: string) => string][] = [
  ["Provocador", (a) => `${a ? `${a}, duvido` : "Duvido"} você acertar mais de 7 sobre mim. Respondi 10 perguntas no orvok, tenta aí:`],
  ["Carinhoso", (a) => `${a ? `${a}, quero` : "Quero"} ver o quanto você me conhece de verdade. Fiz um desafio pra você:`],
  ["Direto", () => "Responde esse desafio do orvok sobre mim? Leva 2 minutos:"],
];

/** Percurso de quem chega pelo anúncio: responde sobre si e desafia alguém, sem cadastro. */
export function FluxoCriar({ desafiarDeVolta, conjuntoDe }: { desafiarDeVolta: string | null; conjuntoDe: string | null }) {
  const [perguntas, setPerguntas] = useState<Pergunta[]>([]);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [tela, setTela] = useState<Tela>("nome");
  const [nome, setNome] = useState("");
  const [i, setI] = useState(0);
  const [respostas, setRespostas] = useState<(number | undefined)[]>([]);
  const [amigo, setAmigo] = useState(desafiarDeVolta ?? "");
  const [tom, setTom] = useState(0);
  const [aceito, setAceito] = useState(false);
  const [codigo, setCodigo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [radarVisivel, setRadarVisivel] = useState(false);
  const [buscando, setBuscando] = useState(false);

  // Abertura: três âncoras (ou, no "desafie de volta", as mesmas 10 perguntas do outro desafio).
  useEffect(() => {
    const url = conjuntoDe ? `/api/v1/desafio/catalogo?de=${encodeURIComponent(conjuntoDe)}` : "/api/v1/desafio/catalogo";
    void fetch(url).then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d: { perguntas?: Pergunta[]; ancoras?: Pergunta[]; aviso: Aviso }) => { setPerguntas(d.perguntas ?? d.ancoras ?? []); setAviso(d.aviso); })
      .catch(() => setErro("Não foi possível carregar as perguntas. Tente de novo em instantes."));
  }, [conjuntoDe]);
  useEffect(() => {
    if (tela !== "pronto") return;
    const t = requestAnimationFrame(() => setRadarVisivel(true));
    return () => cancelAnimationFrame(t);
  }, [tela]);

  const respondidas = respostas.filter((v) => v !== undefined).length;
  const link = codigo ? `${typeof window === "undefined" ? "" : window.location.origin}/d/${codigo}` : "";
  const mensagem = useMemo(() => (desafiarDeVolta
    ? `${desafiarDeVolta}, já tentei te prever. Agora é a sua vez de me prever:`
    : TONS[tom]![1](amigo.trim())), [desafiarDeVolta, tom, amigo]);

  const escolher = (k: number) => {
    if (buscando) return;
    const novas = [...respostas]; novas[i] = k; setRespostas(novas);
    // Terminadas as âncoras, o servidor escolhe as outras sete pelo perfil da pessoa.
    if (i === perguntas.length - 1 && perguntas.length < TOTAL) {
      setBuscando(true);
      void enviarJson<{ perguntas: Pergunta[] }>("/api/v1/desafio/selecao", {
        ancoras: perguntas.map((p, n) => ({ chave: p.chave, opcao: novas[n] ?? 0 })),
      }).then((r) => {
        setBuscando(false);
        if (!r.ok) { setErro("Não foi possível continuar agora. Tente de novo."); return; }
        setPerguntas([...perguntas, ...r.dados.perguntas]); setI(i + 1);
      });
      return;
    }
    window.setTimeout(() => { if (i < perguntas.length - 1) setI(i + 1); else setTela("pronto"); }, 380);
  };
  const voltar = tela === "pergunta" ? () => (i > 0 ? setI(i - 1) : setTela("nome"))
    : tela === "pronto" ? () => { setI(perguntas.length - 1); setTela("pergunta"); }
    : tela === "convite" ? () => setTela("pronto") : undefined;

  /** Cria o desafio uma única vez, no primeiro envio. */
  const garantirDesafio = async (): Promise<string | null> => {
    if (codigo) return codigo;
    if (!aviso) return null;
    setOcupado(true); setErro(null);
    const r = await enviarJson<{ codigo: string }>("/api/v1/desafio", {
      nome, perguntas: perguntas.map((p) => p.chave), respostas: respostas.map((v) => LETRAS[v ?? 0]), consentimento: { aceito: true, versao: aviso.versao, hash: aviso.hash },
    });
    setOcupado(false);
    if (!r.ok) { setErro(r.status === 429 ? "Muitos desafios criados agora. Tente de novo mais tarde." : "Não foi possível criar o desafio. Tente de novo."); return null; }
    setCodigo(r.dados.codigo);
    return r.dados.codigo;
  };
  const enviar = async (canal: "whatsapp" | "copiar" | "outros") => {
    const c = await garantirDesafio();
    if (!c) return;
    const url = `${window.location.origin}/d/${c}`, texto = `${mensagem} ${url}`;
    if (canal === "whatsapp") window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank", "noopener");
    if (canal === "copiar") await navigator.clipboard?.writeText(texto).catch(() => undefined);
    if (canal === "outros" && navigator.share) await navigator.share({ text: mensagem, url }).catch(() => undefined);
    setTela("enviado");
  };

  if (tela === "nome") return (
    <Moldura aoVoltar={voltar}>
      <main className={s.tela}>
        <div className={s.globoTopo}><Globo opcoes={{ pontos: 1100, pessoas: 18, arcos: 9, escala: 0.38, velocidade: 0.003, montagem: 1.2, deslocamento: 0.02 }} /></div>
        <h1 className={s.titulo}>{desafiarDeVolta ? <>Agora é a sua vez. <b>Quanto {desafiarDeVolta} te conhece?</b></> : <>Primeiro, <b>mostre quem você é.</b></>}</h1>
        <p className={s.lead}>Dez perguntas rápidas sobre você. Depois, {desafiarDeVolta ?? "um amigo"} tenta te prever e vocês descobrem quem conhece quem.</p>
        <div className={s.campo}>
          <label htmlFor="nome-desafio">Como os seus amigos te chamam?</label>
          <input id="nome-desafio" autoComplete="given-name" maxLength={24} placeholder="Seu primeiro nome" value={nome}
            onChange={(e) => setNome(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && nome.trim().length >= 2 && perguntas.length) setTela("pergunta"); }} />
        </div>
        <p className={s.miudo}><Icone nome="escudo" />Sem cadastro e sem senha. Ninguém vê as suas respostas, só o placar de quem tentar te prever.</p>
        {erro ? <p className={s.erro} role="alert">{erro}</p> : null}
        <div className={s.empurra}>
          <button className={`${s.btn} ${s.btnAzul}`} type="button" disabled={nome.trim().length < 2 || !perguntas.length} onClick={() => { setI(0); setTela("pergunta"); }}>
            Começar as perguntas<Icone nome="seta" />
          </button>
        </div>
      </main>
    </Moldura>
  );

  if (tela === "pergunta") {
    const q = perguntas[i]!;
    return (
      <Moldura aoVoltar={voltar}>
        <main className={s.tela} key={`q${i}`}>
          <div className={s.progresso} aria-hidden="true">{Array.from({ length: TOTAL }, (_, k) => <i key={k} className={k < respondidas ? s.feito : ""} />)}</div>
          <Anel nome={nome} feitas={respondidas} atual={i} />
          <p className={s.contador}>Pergunta {i + 1} de {TOTAL}</p>
          <h2 className={s.pergunta} id={`perg-${i}`}>{q.texto}</h2>
          <div className={s.opcoes} role="radiogroup" aria-labelledby={`perg-${i}`}>
            {q.opcoes.map((o, k) => (
              <button key={o} className={`${s.op} ${respostas[i] === k ? s.opSel : ""}`} type="button" role="radio" aria-checked={respostas[i] === k} onClick={() => escolher(k)}>
                <span className={s.letra}>{LETRAS[k]}</span>{o}
              </button>
            ))}
          </div>
          {erro ? <p className={s.erro} role="alert">{erro}</p> : null}
          <p className={`${s.miudo} ${s.rodapeQ}`}><Icone nome="olho" />{buscando ? "Escolhendo as próximas perguntas para você…" : "Só você vê as suas respostas"}</p>
        </main>
      </Moldura>
    );
  }

  if (tela === "pronto") return (
    <Moldura aoVoltar={voltar}>
      <main className={`${s.tela} ${s.centro}`}>
        <div className={s.radarGrande}><Radar acertos={10} visivel={radarVisivel} /><Inicial nome={nome} tamanho={88} /></div>
        <h1 className={s.titulo}>Sua referência <b>está pronta, {nome.trim()}.</b></h1>
        <p className={s.lead}>Agora vem a parte boa: desafie alguém e descubra o quanto essa pessoa te conhece.</p>
        <div className={s.empurra}>
          <button className={`${s.btn} ${s.btnAzul}`} type="button" onClick={() => setTela("convite")}><Icone nome="enviar" />{desafiarDeVolta ? `Desafiar ${desafiarDeVolta} de volta` : "Desafiar alguém"}</button>
          <button className={`${s.btn} ${s.btnTexto}`} type="button" onClick={() => { setI(0); setTela("pergunta"); }}>Revisar minhas respostas</button>
        </div>
      </main>
    </Moldura>
  );

  if (tela === "convite") return (
    <Moldura aoVoltar={voltar}>
      <main className={s.tela}>
        <h1 className={s.titulo}>{desafiarDeVolta ? <>Desafie <b>{desafiarDeVolta} de volta</b></> : <>Quem você <b>quer desafiar?</b></>}</h1>
        {desafiarDeVolta ? null : (
          <div className={s.campo}>
            <label htmlFor="amigo-desafio">Nome de quem vai receber (opcional)</label>
            <input id="amigo-desafio" maxLength={24} placeholder="Ex.: Marina" value={amigo} onChange={(e) => setAmigo(e.target.value)} />
          </div>
        )}
        <div className={s.cartaoConv}>
          <Globo opcoes={{ pontos: 900, pessoas: 16, arcos: 8, escala: 0.62, velocidade: 0.003, montagem: 1, deslocamento: 0.35, giroInicial: 2 }} />
          <span className={s.url}>orvok.com.br</span>
          <div className={s.sobre}><Inicial nome={nome} ambar tamanho={46} /><div><b>{nome.trim()} te desafiou</b><small>Quanto você me conhece? 10 perguntas</small></div></div>
        </div>
        {desafiarDeVolta ? null : (
          <div className={s.tons} role="group" aria-label="Tom da mensagem">
            {TONS.map(([rotulo], k) => <button key={rotulo} className={s.tom} type="button" aria-pressed={tom === k} onClick={() => setTom(k)}>{rotulo}</button>)}
          </div>
        )}
        <div className={s.balao}>{mensagem} <span className={s.link}>{link || "orvok.com.br/d/…"}</span></div>
        <label className={s.consent}>
          <input type="checkbox" checked={aceito} onChange={(e) => setAceito(e.target.checked)} />
          <span><b>Aceito ser previsto por quem abrir este convite.</b> A pessoa tenta adivinhar as minhas respostas, mas nunca vê o que eu respondi. Posso cancelar o convite quando quiser.</span>
        </label>
        {erro ? <p className={s.erro} role="alert">{erro}</p> : null}
        <div className={s.empurra}>
          <button className={`${s.btn} ${s.btnAzul}`} type="button" disabled={!aceito || ocupado} onClick={() => void enviar("whatsapp")}><Icone nome="conversa" />Enviar pelo WhatsApp</button>
          <div className={s.linhaBtn}>
            <button className={`${s.btn} ${s.btnFio}`} type="button" disabled={!aceito || ocupado} onClick={() => void enviar("copiar")}><Icone nome="copiar" />Copiar link</button>
            <button className={`${s.btn} ${s.btnFio}`} type="button" disabled={!aceito || ocupado} onClick={() => void enviar("outros")}><Icone nome="mais" />Outros</button>
          </div>
        </div>
      </main>
    </Moldura>
  );

  const quem = desafiarDeVolta ?? (amigo.trim() || null);
  return (
    <Moldura>
      <main className={s.tela}>
        <div className={s.okGrande}><Icone nome="ok" /></div>
        <h1 className={`${s.titulo} ${s.centro}`}>Desafio enviado{quem ? <> para <b>{quem}</b></> : null}.</h1>
        <ol className={s.status}>
          <li className={s.feito}><span className={s.p}><Icone nome="ok" /></span>Você respondeu sobre você</li>
          <li className={s.feito}><span className={s.p}><Icone nome="ok" /></span>Convite enviado</li>
          <li className={s.agora}><span className={s.p} />{quem ?? "Seu amigo"} abre e tenta te prever</li>
          <li><span className={s.p} />Você vê o placar</li>
        </ol>
        <section className={s.oferta}>
          <h2>Quer saber quando {quem ?? "seu amigo"} terminar?</h2>
          <p>Crie sua conta para ver o placar e guardar a sua referência. Leva dez segundos.</p>
          <a className={`${s.btn} ${s.btnClaro}`} href={LOGIN_GOOGLE}>Continuar com Google</a>
          <a className={`${s.btn} ${s.btnFio}`} href="/cadastro?returnTo=%2Fdesafios"><Icone nome="email" />Continuar com e-mail</a>
          <a className={`${s.btn} ${s.btnTexto}`} href="/desafios">Agora não</a>
        </section>
      </main>
    </Moldura>
  );
}
