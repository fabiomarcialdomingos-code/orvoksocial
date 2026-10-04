"use client";
import { useEffect, useMemo, useState } from "react";
import { trackMetaCustomEvent, trackMetaEvent } from "@/lib/client/pixel";
import { Globo } from "./Globo";
import { Anel, Icone, LOGIN_GOOGLE, Inicial, Moldura, enviarJson, estilos as s, useConta } from "./pecas";

type Pergunta = { chave: string; texto: string; opcoes: string[] };
type Aviso = { versao: string; hash: string; texto: string };
type Tela = "relacao" | "nome" | "pergunta" | "pronto" | "convite" | "enviado";
type Relacao = "familia" | "amigos" | "crush";
type Diagnostico = { nome: string; frase: string; descricao: string; marcantes: string[]; tracos: { traco: string; nome: string; polo: string; forca: number }[] };
const LETRAS = ["A", "B", "C", "D"] as const;

const RELACOES: { id: Relacao; rotulo: string; texto: string; campo: string; exemplo: string; icone: "casa" | "pessoas" | "coracao" }[] = [
  { id: "familia", rotulo: "Família", texto: "Mãe, pai, irmãos, avós… quem cresceu com você", campo: "Quem da família vai receber? (opcional)", exemplo: "Ex.: Mãe", icone: "casa" },
  { id: "amigos", rotulo: "Amigos", texto: "Quem está por perto e conhece o seu dia a dia", campo: "Nome do amigo (opcional)", exemplo: "Ex.: Marina", icone: "pessoas" },
  { id: "crush", rotulo: "Alguém especial", texto: "Quem faz o coração acelerar", campo: "Nome da pessoa (opcional)", exemplo: "Ex.: Rafa", icone: "coracao" },
];
const TONS: [string, (nome: string) => string][] = [
  ["Curioso", (a) => `${a ? `${a}, gostaria` : "Gostaria"} de saber como você me vê de verdade. São 12 perguntas no orvok, anônimas:`],
  ["Carinhoso", (a) => `${a ? `${a}, sua` : "Sua"} visão importa para mim. Poderia me contar como você me enxerga? É anônimo:`],
  ["Direto", () => "Poderia compartilhar como você me vê? São 12 perguntas no orvok, leva cerca de 3 minutos e é anônimo:"],
];

/** Percurso de quem chega pelo anúncio: responde sobre si e convida alguém para compartilhar a sua visão, sem cadastro. */
export function FluxoCriar({ convidarDeVolta, conjuntoDe, relacaoInicial = null }: { convidarDeVolta: string | null; conjuntoDe: string | null; relacaoInicial?: Relacao | null }) {
  const [perguntas, setPerguntas] = useState<Pergunta[]>([]);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [tela, setTela] = useState<Tela>(conjuntoDe || relacaoInicial ? "nome" : "relacao");
  const [relacao, setRelacao] = useState<Relacao>(relacaoInicial ?? "amigos");
  const [escolheu, setEscolheu] = useState(Boolean(relacaoInicial));
  const [nome, setNome] = useState("");
  const [i, setI] = useState(0);
  const [respostas, setRespostas] = useState<(number | undefined)[]>([]);
  const [amigo, setAmigo] = useState(convidarDeVolta ?? "");
  const [tom, setTom] = useState(0);
  const [aceito, setAceito] = useState(false);
  const [codigo, setCodigo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [diag, setDiag] = useState<Diagnostico | null>(null);
  // Quem chega aqui está vendo a experiência principal do orvok (campanha Meta Ads, seção 6 do briefing).
  useEffect(() => { trackMetaEvent("ViewContent", { content_name: "comecar" }); }, []);
  // Quem já tem conta não precisa se apresentar: o nome vem do perfil.
  const conta = useConta();
  const logado = Boolean(conta);
  const nomeEfetivo = conta?.nome ?? nome;

  // Abertura: as 12 perguntas da relação (ou, no "convidar de volta", as mesmas do outro convite).
  useEffect(() => {
    if (!conjuntoDe && !escolheu) return;
    const url = conjuntoDe ? `/api/v1/desafio/catalogo?de=${encodeURIComponent(conjuntoDe)}` : `/api/v1/desafio/catalogo?rel=${relacao}`;
    void fetch(url).then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d: { perguntas?: Pergunta[]; relacao?: Relacao; aviso: Aviso }) => {
        setPerguntas(d.perguntas ?? []); setAviso(d.aviso); if (d.relacao) setRelacao(d.relacao);
      })
      .catch(() => setErro("Não foi possível carregar as perguntas. Tente de novo em instantes."));
  }, [conjuntoDe, relacao, escolheu]);
  const total = perguntas.length || 12;

  const respondidas = respostas.filter((v) => v !== undefined).length;
  const link = codigo ? `${typeof window === "undefined" ? "" : window.location.origin}/d/${codigo}` : "";
  const mensagem = useMemo(() => (convidarDeVolta
    ? `${convidarDeVolta}, respondi sobre você no orvok. Agora gostaria de saber como você me vê:`
    : TONS[tom]![1](amigo.trim())), [convidarDeVolta, tom, amigo]);

  const escolher = (k: number) => {
    const novas = [...respostas]; novas[i] = k; setRespostas(novas);
    window.setTimeout(() => {
      if (i < perguntas.length - 1) { setI(i + 1); return; }
      setTela("pronto");
      void enviarJson<{ perfil: Diagnostico }>("/api/v1/desafio/perfil", { perguntas: perguntas.map((p) => p.chave), respostas: novas.map((v) => LETRAS[v ?? 0]) })
        .then((r) => { if (r.ok) setDiag(r.dados.perfil); });
    }, 380);
  };
  const voltar = tela === "nome" && !conjuntoDe ? () => setTela("relacao")
    : tela === "pergunta" ? () => (i > 0 ? setI(i - 1) : setTela(logado ? (conjuntoDe ? "pergunta" : "relacao") : "nome"))
    : tela === "pronto" ? () => { setI(perguntas.length - 1); setTela("pergunta"); }
    : tela === "convite" ? () => setTela("pronto") : undefined;

  /** Cria o convite uma única vez, no primeiro envio. */
  const garantirConvite = async (): Promise<string | null> => {
    if (codigo) return codigo;
    if (!aviso) return null;
    setOcupado(true); setErro(null);
    const r = await enviarJson<{ codigo: string }>("/api/v1/desafio", {
      nome: nomeEfetivo, relacao, perguntas: perguntas.map((p) => p.chave), respostas: respostas.map((v) => LETRAS[v ?? 0]), consentimento: { aceito: true, versao: aviso.versao, hash: aviso.hash },
    });
    setOcupado(false);
    if (!r.ok) { setErro(r.status === 429 ? "Muitos convites criados agora. Tente de novo mais tarde." : "Não foi possível criar o convite. Tente de novo."); return null; }
    setCodigo(r.dados.codigo);
    return r.dados.codigo;
  };
  const enviar = async (canal: "whatsapp" | "copiar" | "outros") => {
    const c = await garantirConvite();
    if (!c) return;
    const url = `${window.location.origin}/d/${c}`, texto = `${mensagem} ${url}`;
    if (canal === "whatsapp") window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank", "noopener");
    if (canal === "copiar") await navigator.clipboard?.writeText(texto).catch(() => undefined);
    if (canal === "outros" && navigator.share) await navigator.share({ text: mensagem, url }).catch(() => undefined);
    trackMetaCustomEvent("Convite", { content_name: "retrato" }); // "compartilhamento ou convite" (briefing, seção 6)
    setTela("enviado");
  };

  if (tela === "relacao") return (
    <Moldura>
      <main className={s.tela}>
        <h1 className={s.titulo}>Quem vai <b>dizer como te vê?</b></h1>
        <p className={s.lead}>As perguntas mudam conforme a relação. A família, os amigos e as pessoas especiais conhecem lados diferentes de você.</p>
        <div className={s.opcoes} role="radiogroup" aria-label="Quem vai compartilhar a visão sobre você">
          {RELACOES.map((rel) => (
            <button key={rel.id} className={`${s.op} ${s.relacao} ${escolheu && relacao === rel.id ? s.opSel : ""}`} type="button" role="radio" aria-checked={escolheu && relacao === rel.id}
              onClick={() => { trackMetaEvent("Lead", { content_name: "retrato" }); if (rel.id !== relacao) { setPerguntas([]); setRespostas([]); } setRelacao(rel.id); setEscolheu(true); setTom(0); window.setTimeout(() => { setI(0); setTela(logado ? "pergunta" : "nome"); }, 250); }}>
              <span className={s.letra}><Icone nome={rel.icone} /></span>
              <span><b>{rel.rotulo}</b><small>{rel.texto}</small></span>
            </button>
          ))}
        </div>
        <p className={`${s.miudo} ${s.rodapeQ}`}><Icone nome="escudo" />Sem cadastro para começar. Dá para convidar os outros grupos depois.</p>
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
        <h1 className={s.titulo}>{convidarDeVolta ? <>Agora é a sua vez. <b>Como {convidarDeVolta} te vê?</b></> : <>Primeiro, <b>mostre quem você é.</b></>}</h1>
        <p className={s.lead}>Doze perguntas sobre você. Você recebe o seu perfil na hora, e depois quem você convidar compartilha como te enxerga.</p>
        <div className={s.campo}>
          <label htmlFor="nome-desafio">Como as pessoas próximas te chamam?</label>
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

  if (tela === "pronto") return (
    <Moldura aoVoltar={voltar}>
      <main className={s.tela}>
        {!diag ? <p className={s.lead} aria-busy="true">Montando o seu perfil…</p> : (
          <div className={s.diagnostico}>
            <div className={s.centro}><span className={s.chipRelacao}>Como você se vê</span></div>
            <div style={{ display: "flex", justifyContent: "center", margin: "6px 0 14px" }}><Inicial nome={nomeEfetivo} ambar tamanho={84} /></div>
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
          <button className={`${s.btn} ${s.btnAzul}`} type="button" disabled={!diag} onClick={() => setTela("convite")}><Icone nome="enviar" />Convidar alguém</button>
          <p className={s.miudo} style={{ justifyContent: "center" }}>Convide pessoas para compartilhar como te enxergam. Com 3 respostas, aparece o seu retrato e o seu selo.</p>
        </div>
      </main>
    </Moldura>
  );

  if (tela === "convite") return (
    <Moldura aoVoltar={voltar}>
      <main className={s.tela}>
        <h1 className={s.titulo}>{convidarDeVolta ? <>Convide <b>{convidarDeVolta}</b></> : <>Quem vai <b>dizer como te vê?</b></>}</h1>
        {convidarDeVolta ? null : (
          <div className={s.campo}>
            <label htmlFor="amigo-desafio">{RELACOES.find((x) => x.id === relacao)!.campo}</label>
            <input id="amigo-desafio" maxLength={24} placeholder={RELACOES.find((x) => x.id === relacao)!.exemplo} value={amigo} onChange={(e) => setAmigo(e.target.value)} />
          </div>
        )}
        <div className={s.cartaoConv}>
          <Globo opcoes={{ pontos: 900, pessoas: 16, arcos: 8, escala: 0.62, velocidade: 0.003, montagem: 1, deslocamento: 0.35, giroInicial: 2 }} />
          <span className={s.url}>orvok.com.br</span>
          <div className={s.sobre}><Inicial nome={nomeEfetivo} ambar tamanho={46} /><div><b>Como você vê {nomeEfetivo.trim()}?</b><small>12 perguntas · anônimo</small></div></div>
        </div>
        {convidarDeVolta ? null : (
          <div className={s.tons} role="group" aria-label="Tom da mensagem">
            {TONS.map(([rotulo], k) => <button key={rotulo} className={s.tom} type="button" aria-pressed={tom === k} onClick={() => setTom(k)}>{rotulo}</button>)}
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

  const quem = convidarDeVolta ?? (amigo.trim() || null);
  return (
    <Moldura>
      <main className={s.tela}>
        <div className={s.okGrande}><Icone nome="ok" /></div>
        <h1 className={`${s.titulo} ${s.centro}`}>Convite enviado{quem ? <> para <b>{quem}</b></> : null}.</h1>
        <ol className={s.status}>
          <li className={s.feito}><span className={s.p}><Icone nome="ok" /></span>Você respondeu sobre você</li>
          <li className={s.feito}><span className={s.p}><Icone nome="ok" /></span>Convite enviado</li>
          <li className={s.agora}><span className={s.p} />{quem ?? "A pessoa"} compartilha como te vê</li>
          <li><span className={s.p} />Com 3 respostas, aparece o seu retrato</li>
        </ol>
        {logado ? (
          <section className={s.oferta}>
            <h2>Pronto! Acompanhe em Meu retrato.</h2>
            <p>Você recebe o aviso em Notificações assim que {quem ?? "a pessoa"} responder.</p>
            <a className={`${s.btn} ${s.btnAzul}`} href="/retrato">Ver meu retrato</a>
            <a className={`${s.btn} ${s.btnFio}`} href="/comecar">Convidar mais alguém</a>
            <a className={`${s.btn} ${s.btnTexto}`} href="/painel">Voltar ao início</a>
          </section>
        ) : (
        <section className={s.oferta}>
          <h2>Quer saber quando {quem ?? "a pessoa"} terminar?</h2>
          <p>Crie sua conta para ver o seu retrato e guardar a sua referência. Leva dez segundos.</p>
          <a className={`${s.btn} ${s.btnClaro}`} href={LOGIN_GOOGLE}>Continuar com Google</a>
          <a className={`${s.btn} ${s.btnFio}`} href="/cadastro?returnTo=%2Fretrato"><Icone nome="email" />Continuar com e-mail</a>
          <a className={`${s.btn} ${s.btnTexto}`} href="/desafios">Agora não</a>
        </section>
        )}
      </main>
    </Moldura>
  );
}
