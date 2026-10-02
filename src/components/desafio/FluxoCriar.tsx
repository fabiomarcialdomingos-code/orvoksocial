"use client";
import { useEffect, useMemo, useState } from "react";
import { Globo } from "./Globo";
import { Anel, Icone, LOGIN_GOOGLE, Inicial, Moldura, Radar, enviarJson, estilos as s, useConta } from "./pecas";
import { trackMetaEvent, trackMetaCustomEvent } from "@/lib/client/pixel";

type Pergunta = { chave: string; texto: string; opcoes: string[] };
type Aviso = { versao: string; hash: string; texto: string };
type Tela = "tipo" | "relacao" | "nome" | "pergunta" | "pronto" | "convite" | "enviado";
type Tipo = "desafio" | "retrato";
type Relacao = "familia" | "amigos" | "crush";
type Diagnostico = { nome: string; frase: string; descricao: string; marcantes: string[]; tracos: { traco: string; nome: string; polo: string; forca: number }[] };
const LETRAS = ["A", "B", "C", "D"] as const;

const RELACOES: { id: Relacao; rotulo: string; texto: string; campo: string; exemplo: string; icone: "casa" | "pessoas" | "coracao" }[] = [
  { id: "familia", rotulo: "Família", texto: "Mãe, pai, irmãos, avós… quem cresceu com você", campo: "Quem da família vai receber? (opcional)", exemplo: "Ex.: Mãe", icone: "casa" },
  { id: "amigos", rotulo: "Amigos", texto: "Quem está sempre por perto e acha que te conhece", campo: "Nome do amigo (opcional)", exemplo: "Ex.: Marina", icone: "pessoas" },
  { id: "crush", rotulo: "Crush", texto: "Quem faz o coração acelerar. Será que te conhece mesmo?", campo: "Nome do crush (opcional)", exemplo: "Ex.: Rafa", icone: "coracao" },
];
const TONS_RETRATO: [string, (amigo: string) => string][] = [
  ["Curioso", (a) => `${a ? `${a}, quero` : "Quero"} saber como você me vê de verdade. São 12 perguntas no orvok e é anônimo:`],
  ["Carinhoso", (a) => `${a ? `${a}, sua` : "Sua"} opinião importa pra mim. Me conta como você me enxerga? É anônimo:`],
  ["Direto", () => "Responde como você me vê? 12 perguntas no orvok, leva 3 minutos e é anônimo:"],
];
const TONS: Record<Relacao, [string, (amigo: string) => string][]> = {
  familia: [
    ["Provocador", (a) => `${a ? `${a}, duvido` : "Duvido"} você acertar as 5 sobre mim! Quem da família me conhece melhor?`],
    ["Carinhoso", (a) => `${a ? `${a}, será` : "Será"} que você me conhece tanto quanto eu acho? Fiz um desafio pra você:`],
    ["Direto", () => "Responde esse desafio do orvok sobre mim? Leva 1 minuto:"],
  ],
  amigos: [
    ["Provocador", (a) => `${a ? `${a}, duvido` : "Duvido"} você acertar as 5 sobre mim. Respondi no orvok, tenta aí:`],
    ["Carinhoso", (a) => `${a ? `${a}, quero` : "Quero"} ver o quanto você me conhece de verdade. Fiz um desafio pra você:`],
    ["Direto", () => "Responde esse desafio do orvok sobre mim? Leva 1 minuto:"],
  ],
  crush: [
    ["Provocador", (a) => `${a ? `${a}, será` : "Será"} que você me conhece mesmo? Duvido acertar as 5. Tenta aí:`],
    ["Carinhoso", (a) => `${a ? `${a}, fiz` : "Fiz"} um desafio só pra você. Quero ver o quanto você me conhece:`],
    ["Direto", () => "Responde esse desafio do orvok sobre mim? Leva 1 minuto:"],
  ],
};

/** Percurso de quem chega pelo anúncio: responde sobre si e desafia alguém, sem cadastro. */
export function FluxoCriar({ desafiarDeVolta, conjuntoDe, relacaoInicial = null, tipoInicial = null }: { desafiarDeVolta: string | null; conjuntoDe: string | null; relacaoInicial?: Relacao | null; tipoInicial?: Tipo | null }) {
  const [perguntas, setPerguntas] = useState<Pergunta[]>([]);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [tipo, setTipo] = useState<Tipo>(tipoInicial ?? "desafio");
  const [tela, setTela] = useState<Tela>(conjuntoDe ? "nome" : !tipoInicial ? "tipo" : relacaoInicial ? "nome" : "relacao");
  const [relacao, setRelacao] = useState<Relacao>(relacaoInicial ?? "amigos");
  const [escolheu, setEscolheu] = useState(Boolean(relacaoInicial));
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
  const [diag, setDiag] = useState<Diagnostico | null>(null);
  // Quem já tem conta não precisa se apresentar: o nome vem do perfil.
  const conta = useConta();
  const logado = Boolean(conta);
  const nomeEfetivo = conta?.nome ?? nome;

  // Abertura: três âncoras (ou, no "desafie de volta", as mesmas 10 perguntas do outro desafio).
  useEffect(() => {
    if (!conjuntoDe && !escolheu) return;
    const url = conjuntoDe ? `/api/v1/desafio/catalogo?de=${encodeURIComponent(conjuntoDe)}` : `/api/v1/desafio/catalogo?rel=${relacao}&tipo=${tipo}`;
    void fetch(url).then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d: { perguntas?: Pergunta[]; relacao?: Relacao; tipo?: Tipo; aviso: Aviso }) => {
        setPerguntas(d.perguntas ?? []); setAviso(d.aviso); if (d.relacao) setRelacao(d.relacao); if (d.tipo) setTipo(d.tipo);
      })
      .catch(() => setErro("Não foi possível carregar as perguntas. Tente de novo em instantes."));
  }, [conjuntoDe, relacao, escolheu, tipo]);
  // Quem chega aqui está vendo a experiência principal do orvok (campanha Meta Ads, seção 6 do briefing).
  useEffect(() => { trackMetaEvent("ViewContent", { content_name: "comecar" }); }, []);
  const total = perguntas.length || (tipo === "retrato" ? 12 : 5);
  useEffect(() => {
    if (tela !== "pronto") return;
    const t = requestAnimationFrame(() => setRadarVisivel(true));
    return () => cancelAnimationFrame(t);
  }, [tela]);

  const respondidas = respostas.filter((v) => v !== undefined).length;
  const link = codigo ? `${typeof window === "undefined" ? "" : window.location.origin}/d/${codigo}` : "";
  const mensagem = useMemo(() => (desafiarDeVolta
    ? `${desafiarDeVolta}, já tentei te prever. Agora é a sua vez de me prever:`
    : (tipo === "retrato" ? TONS_RETRATO : TONS[relacao])[tom]![1](amigo.trim())), [desafiarDeVolta, tom, amigo, relacao, tipo]);

  const escolher = (k: number) => {
    const novas = [...respostas]; novas[i] = k; setRespostas(novas);
    window.setTimeout(() => {
      if (i < perguntas.length - 1) { setI(i + 1); return; }
      setTela("pronto");
      if (tipo !== "retrato") return;
      void enviarJson<{ perfil: Diagnostico }>("/api/v1/desafio/perfil", { perguntas: perguntas.map((p) => p.chave), respostas: novas.map((v) => LETRAS[v ?? 0]) })
        .then((r) => { if (r.ok) setDiag(r.dados.perfil); });
    }, 380);
  };
  const voltar = tela === "relacao" && !tipoInicial ? () => setTela("tipo")
    : tela === "nome" && !conjuntoDe ? () => setTela("relacao")
    : tela === "pergunta" ? () => (i > 0 ? setI(i - 1) : setTela(logado ? (conjuntoDe ? "pergunta" : "relacao") : "nome"))
    : tela === "pronto" ? () => { setI(perguntas.length - 1); setTela("pergunta"); }
    : tela === "convite" ? () => setTela("pronto") : undefined;

  /** Cria o desafio uma única vez, no primeiro envio. */
  const garantirDesafio = async (): Promise<string | null> => {
    if (codigo) return codigo;
    if (!aviso) return null;
    setOcupado(true); setErro(null);
    const r = await enviarJson<{ codigo: string }>("/api/v1/desafio", {
      nome: nomeEfetivo, relacao, tipo, perguntas: perguntas.map((p) => p.chave), respostas: respostas.map((v) => LETRAS[v ?? 0]), consentimento: { aceito: true, versao: aviso.versao, hash: aviso.hash },
    });
    setOcupado(false);
    if (!r.ok) { setErro(r.status === 429 ? "Muitos desafios criados agora. Tente de novo mais tarde." : "Não foi possível criar o desafio. Tente de novo."); return null; }
    setCodigo(r.dados.codigo);
    trackMetaCustomEvent("Convite", { content_name: tipo }); // "compartilhamento ou convite" (briefing, seção 6)
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

  if (tela === "tipo") return (
    <Moldura>
      <main className={s.tela}>
        <h1 className={s.titulo}>O que você <b>quer descobrir?</b></h1>
        <p className={s.lead}>São dois jogos diferentes. Dá para fazer os dois.</p>
        <div className={s.opcoes} role="radiogroup" aria-label="O que você quer descobrir">
          <button className={`${s.op} ${s.relacao}`} type="button" role="radio" aria-checked={false}
            onClick={() => { trackMetaEvent("Lead", { content_name: "desafio" }); setTipo("desafio"); setPerguntas([]); setRespostas([]); setTela(relacaoInicial ? (logado ? "pergunta" : "nome") : "relacao"); if (relacaoInicial) setEscolheu(true); }}>
            <span className={s.letra}><Icone nome="alvo" /></span>
            <span><b>Quanto te conhecem?</b><small>5 perguntas · 1 minuto. Seu amigo tenta adivinhar o que você respondeu e ganha um placar.</small></span>
          </button>
          <button className={`${s.op} ${s.relacao}`} type="button" role="radio" aria-checked={false}
            onClick={() => { trackMetaEvent("Lead", { content_name: "retrato" }); setTipo("retrato"); setPerguntas([]); setRespostas([]); setTela(relacaoInicial ? (logado ? "pergunta" : "nome") : "relacao"); if (relacaoInicial) setEscolheu(true); }}>
            <span className={s.letra}><Icone nome="olho" /></span>
            <span><b>Como te veem?</b><small>12 perguntas · 3 minutos. Você recebe seu perfil, e quem você convidar diz como te enxerga, sem se identificar.</small></span>
          </button>
        </div>
        <p className={`${s.miudo} ${s.rodapeQ}`}><Icone nome="escudo" />Sem cadastro para começar.</p>
      </main>
    </Moldura>
  );

  if (tela === "relacao") return (
    <Moldura>
      <main className={s.tela}>
        <h1 className={s.titulo}>{tipo === "retrato" ? <>Quem vai <b>dizer como te vê?</b></> : <>Quem você <b>quer desafiar?</b></>}</h1>
        <p className={s.lead}>As perguntas mudam conforme a relação. A família, os amigos e o crush conhecem lados diferentes de você.</p>
        <div className={s.opcoes} role="radiogroup" aria-label="Quem você quer desafiar">
          {RELACOES.map((rel) => (
            <button key={rel.id} className={`${s.op} ${s.relacao} ${escolheu && relacao === rel.id ? s.opSel : ""}`} type="button" role="radio" aria-checked={escolheu && relacao === rel.id}
              onClick={() => { if (rel.id !== relacao) { setPerguntas([]); setRespostas([]); } setRelacao(rel.id); setEscolheu(true); setTom(0); window.setTimeout(() => { setI(0); setTela(logado ? "pergunta" : "nome"); }, 250); }}>
              <span className={s.letra}><Icone nome={rel.icone} /></span>
              <span><b>{rel.rotulo}</b><small>{rel.texto}</small></span>
            </button>
          ))}
        </div>
        <p className={`${s.miudo} ${s.rodapeQ}`}><Icone nome="escudo" />Sem cadastro para começar. Dá para desafiar os outros grupos depois.</p>
      </main>
    </Moldura>
  );

  if (tela === "nome" && conta === undefined) return <Moldura><main className={s.tela} aria-busy="true" /></Moldura>;
  if (tela === "nome" && logado) {
    // Com conta: sem tela de nome. Vai direto às perguntas assim que elas chegarem.
    if (perguntas.length) queueMicrotask(() => { setI(0); setTela("pergunta"); });
    return <Moldura><main className={s.tela} aria-busy="true" /></Moldura>;
  }
  if (tela === "pergunta" && !perguntas.length) return <Moldura><main className={s.tela} aria-busy="true" /></Moldura>;

  if (tela === "nome") return (
    <Moldura aoVoltar={voltar}>
      <main className={s.tela}>
        <div className={s.globoTopo}><Globo opcoes={{ pontos: 1100, pessoas: 18, arcos: 9, escala: 0.38, velocidade: 0.003, montagem: 1.2, deslocamento: 0.02 }} /></div>
        <h1 className={s.titulo}>{desafiarDeVolta ? <>Agora é a sua vez. <b>Quanto {desafiarDeVolta} te conhece?</b></> : <>Primeiro, <b>mostre quem você é.</b></>}</h1>
        <p className={s.lead}>{tipo === "retrato"
          ? "Doze perguntas sobre você. Você recebe o seu perfil na hora, e depois quem você convidar diz como te enxerga."
          : `Cinco perguntas rápidas sobre você. Depois, ${desafiarDeVolta ?? "um amigo"} tenta adivinhar e vocês descobrem quem conhece quem.`}</p>
        <div className={s.campo}>
          <label htmlFor="nome-desafio">Como os seus amigos te chamam?</label>
          <input id="nome-desafio" autoComplete="given-name" maxLength={24} placeholder="Seu primeiro nome" value={nome}
            onChange={(e) => setNome(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && nome.trim().length >= 2 && perguntas.length) setTela("pergunta"); }} />
        </div>
        <p className={s.miudo}><Icone nome="escudo" />Sem cadastro e sem senha. Ninguém vê as suas respostas.</p>
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
          <div className={s.progresso} aria-hidden="true">{Array.from({ length: total }, (_, k) => <i key={k} className={k < respondidas ? s.feito : ""} />)}</div>
          <Anel nome={nomeEfetivo} feitas={respondidas} atual={i} />
          <p className={s.contador}>Pergunta {i + 1} de {total}</p>
          <h2 className={s.pergunta} id={`perg-${i}`}>{q.texto}</h2>
          <div className={s.opcoes} role="radiogroup" aria-labelledby={`perg-${i}`}>
            {q.opcoes.map((o, k) => (
              <button key={o} className={`${s.op} ${respostas[i] === k ? s.opSel : ""}`} type="button" role="radio" aria-checked={respostas[i] === k} onClick={() => escolher(k)}>
                <span className={s.letra}>{LETRAS[k]}</span>{o}
              </button>
            ))}
          </div>
          {erro ? <p className={s.erro} role="alert">{erro}</p> : null}
          <p className={`${s.miudo} ${s.rodapeQ}`}><Icone nome="olho" />Só você vê as suas respostas</p>
        </main>
      </Moldura>
    );
  }

  if (tela === "pronto" && tipo === "desafio") return (
    <Moldura aoVoltar={voltar}>
      <main className={`${s.tela} ${s.centro}`}>
        <div className={s.radarGrande}><Radar acertos={5} total={5} visivel={radarVisivel} /><Inicial nome={nomeEfetivo} tamanho={88} /></div>
        <h1 className={s.titulo}>Suas 5 respostas <b>estão guardadas.</b></h1>
        <p className={s.lead}>Agora mande para alguém. A pessoa tenta adivinhar o que você respondeu e vê o placar no final.</p>
        <div className={s.empurra}>
          <button className={`${s.btn} ${s.btnAzul}`} type="button" onClick={() => setTela("convite")}><Icone nome="enviar" />{desafiarDeVolta ? `Desafiar ${desafiarDeVolta}` : "Desafiar alguém"}</button>
          <p className={s.miudo} style={{ justifyContent: "center" }}><span>Quer saber como as pessoas te enxergam? Faça também o <a className="text-link" href="/comecar?tipo=retrato">Retrato</a>.</span></p>
        </div>
      </main>
    </Moldura>
  );

  if (tela === "pronto") return (
    <Moldura aoVoltar={voltar}>
      <main className={s.tela}>
        {!diag ? <p className={s.lead} aria-busy="true">Montando o seu perfil…</p> : (
          <div className={s.diagnostico}>
            <div className={s.centro}><span className={s.chipRelacao}>Como você se vê</span></div>
            <div className={s.radarGrande} style={{ width: "min(200px, 50vw)" }}><Radar acertos={12} total={12} visivel={radarVisivel} /><Inicial nome={nomeEfetivo} tamanho={72} /></div>
            <h1 className={`${s.titulo} ${s.centro}`}>Você se vê como <b>{diag.nome}</b></h1>
            <p className={`${s.lead} ${s.centro}`} style={{ marginBottom: 12 }}>{diag.frase}</p>
            <div className={s.marcantes}><small>Traços marcantes</small>{diag.marcantes.map((m) => <span key={m}>{m}</span>)}</div>
            <div className={s.barras}>
              {diag.tracos.map((t, k) => (
                <div key={t.traco} className={s.barraTraco} style={{ animationDelay: `${k * 90}ms` }}>
                  <div className={s.barraTopo}><span>{t.nome}</span><b>{t.polo} {t.forca}%</b></div>
                  <i><em style={{ width: `${t.forca}%` }} /></i>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className={s.empurra}>
          <button className={`${s.btn} ${s.btnAzul}`} type="button" disabled={!diag} onClick={() => setTela("convite")}><Icone nome="enviar" />Descobrir se te veem assim</button>
          <p className={s.miudo} style={{ justifyContent: "center" }}>Convide pessoas para dizer como te enxergam. Com 3 respostas, aparece o seu retrato e o seu selo.</p>
        </div>
      </main>
    </Moldura>
  );

  if (tela === "convite") return (
    <Moldura aoVoltar={voltar}>
      <main className={s.tela}>
        <h1 className={s.titulo}>{desafiarDeVolta ? <>Desafie <b>{desafiarDeVolta} de volta</b></> : tipo === "retrato" ? <>Quem vai <b>dizer como te vê?</b></> : <>Quem você <b>quer desafiar?</b></>}</h1>
        {desafiarDeVolta ? null : (
          <div className={s.campo}>
            <label htmlFor="amigo-desafio">{RELACOES.find((x) => x.id === relacao)!.campo}</label>
            <input id="amigo-desafio" maxLength={24} placeholder={RELACOES.find((x) => x.id === relacao)!.exemplo} value={amigo} onChange={(e) => setAmigo(e.target.value)} />
          </div>
        )}
        <div className={s.cartaoConv}>
          <Globo opcoes={{ pontos: 900, pessoas: 16, arcos: 8, escala: 0.62, velocidade: 0.003, montagem: 1, deslocamento: 0.35, giroInicial: 2 }} />
          <span className={s.url}>orvok.com.br</span>
          <div className={s.sobre}><Inicial nome={nomeEfetivo} ambar tamanho={46} /><div><b>{nomeEfetivo.trim()} te desafiou</b><small>Quanto você me conhece? 10 perguntas</small></div></div>
        </div>
        {desafiarDeVolta ? null : (
          <div className={s.tons} role="group" aria-label="Tom da mensagem">
            {(tipo === "retrato" ? TONS_RETRATO : TONS[relacao]).map(([rotulo], k) => <button key={rotulo} className={s.tom} type="button" aria-pressed={tom === k} onClick={() => setTom(k)}>{rotulo}</button>)}
          </div>
        )}
        <div className={s.balao}>{mensagem} <span className={s.link}>{link || "orvok.com.br/d/…"}</span></div>
        <label className={s.consent}>
          <input type="checkbox" checked={aceito} onChange={(e) => setAceito(e.target.checked)} />
          <span><b>Aceito que quem abrir este convite responda sobre mim.</b> A pessoa nunca vê o que eu respondi. Posso cancelar o convite quando quiser. Confirmo ter pelo menos 16 anos e aceito os <a className="text-link" href="/termos" target="_blank" rel="noopener noreferrer">Termos de uso</a> e a <a className="text-link" href="/privacidade" target="_blank" rel="noopener noreferrer">Política de privacidade</a>.</span>
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
        <h1 className={`${s.titulo} ${s.centro}`}>{tipo === "retrato" ? "Convite enviado" : "Desafio enviado"}{quem ? <> para <b>{quem}</b></> : null}.</h1>
        <ol className={s.status}>
          <li className={s.feito}><span className={s.p}><Icone nome="ok" /></span>Você respondeu sobre você</li>
          <li className={s.feito}><span className={s.p}><Icone nome="ok" /></span>Convite enviado</li>
          <li className={s.agora}><span className={s.p} />{tipo === "retrato" ? `${quem ?? "A pessoa"} diz como te vê` : `${quem ?? "Seu amigo"} abre e tenta te prever`}</li>
          <li><span className={s.p} />{tipo === "retrato" ? "Com 3 respostas, aparece o seu retrato" : "Você vê o placar"}</li>
        </ol>
        {logado ? (
          <section className={s.oferta}>
            <h2>{tipo === "retrato" ? "Pronto! Acompanhe em Meu retrato." : "Pronto! O placar aparece em Desafios."}</h2>
            <p>Você recebe o aviso em Notificações assim que {quem ?? "a pessoa"} responder.</p>
            <a className={`${s.btn} ${s.btnAzul}`} href="/desafios">Ver meus desafios</a>
            <a className={`${s.btn} ${s.btnFio}`} href="/comecar">Desafiar mais alguém</a>
            <a className={`${s.btn} ${s.btnTexto}`} href="/painel">Voltar ao início</a>
          </section>
        ) : (
        <section className={s.oferta}>
          <h2>Quer saber quando {quem ?? "seu amigo"} terminar?</h2>
          <p>Crie sua conta para ver o placar e guardar a sua referência. Leva dez segundos.</p>
          <a className={`${s.btn} ${s.btnClaro}`} href={LOGIN_GOOGLE}>Continuar com Google</a>
          <a className={`${s.btn} ${s.btnFio}`} href="/cadastro?returnTo=%2Fdesafios"><Icone nome="email" />Continuar com e-mail</a>
          <a className={`${s.btn} ${s.btnTexto}`} href="/desafios">Agora não</a>
        </section>
        )}
      </main>
    </Moldura>
  );
}
