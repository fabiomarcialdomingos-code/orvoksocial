"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Globo } from "./Globo";
import { Anel, Icone, Inicial, Moldura, Radar, enviarJson, estilos as s, useConta } from "./pecas";

type Pergunta = { chave: string; texto: string; opcoes: string[] };
type Vitrine = { nome: string; relacao: "familia" | "amigos" | "crush"; proprio: boolean; perguntas: Pergunta[]; resultado: { score: number; total: number } | null };
const LETRAS = ["A", "B", "C", "D"] as const;

function veredito(n: number, nome: string) {
  if (n >= 9) return `Assustador. Você conhece ${nome} melhor do que ninguém.`;
  if (n >= 7) return `Você conhece ${nome} de verdade.`;
  if (n >= 4) return `Você conhece bem ${nome}, mas ainda há surpresas.`;
  return `${nome} ainda tem muito para te mostrar.`;
}

/** Percurso de quem recebe o convite: prevê sem cadastro e vê só o placar. */
export function FluxoPrever({ codigo }: { codigo: string }) {
  const router = useRouter();
  const [v, setV] = useState<Vitrine | null>(null);
  const [falha, setFalha] = useState<string | null>(null);
  const [tela, setTela] = useState<"desafio" | "prever" | "placar">("desafio");
  const [i, setI] = useState(0);
  const [prev, setPrev] = useState<(number | undefined)[]>([]);
  const [placar, setPlacar] = useState<{ acertos: number; total: number } | null>(null);
  const [contagem, setContagem] = useState(0);
  const [meuNome, setMeuNome] = useState("");
  const conta = useConta();
  const nomeFinal = conta?.nome ?? meuNome;

  useEffect(() => {
    void fetch(`/api/v1/desafio/${encodeURIComponent(codigo)}`).then(async (r) => {
      if (!r.ok) { setFalha(r.status === 404 ? "Este desafio não existe mais ou expirou." : "Não foi possível abrir o desafio agora."); return; }
      const d = (await r.json()) as Vitrine;
      setV(d);
      if (d.resultado) { setPlacar({ acertos: d.resultado.score, total: d.resultado.total }); setTela("placar"); }
    }).catch(() => setFalha("Não foi possível abrir o desafio agora."));
  }, [codigo]);

  useEffect(() => {
    if (tela !== "placar" || !placar) return;
    const alvo = placar.acertos, t0 = performance.now();
    let id = 0;
    const passo = (t: number) => { const k = Math.min(1, (t - t0) / 1300); setContagem(Math.round(alvo * (1 - Math.pow(1 - k, 3)))); if (k < 1) id = requestAnimationFrame(passo); };
    id = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(id);
  }, [tela, placar]);

  const concluir = async (lista: (number | undefined)[]) => {
    const r = await enviarJson<{ acertos: number; total: number }>(`/api/v1/desafio/${encodeURIComponent(codigo)}/tentativa`, { nome: nomeFinal.trim(), previsoes: lista.map((x) => LETRAS[x ?? 0]) });
    if (!r.ok) { setFalha(r.dados.code === "OWN_CHALLENGE" ? "Este desafio é seu. Envie o link para alguém tentar te prever." : "Não foi possível registrar agora. Tente de novo."); return; }
    setPlacar(r.dados); setTela("placar");
  };
  const escolher = (k: number) => {
    const novas = [...prev]; novas[i] = k; setPrev(novas);
    window.setTimeout(() => { if (v && i < v.perguntas.length - 1) setI(i + 1); else void concluir(novas); }, 380);
  };

  if (falha) return (
    <Moldura><main className={`${s.tela} ${s.centro}`}><h1 className={s.titulo}>{falha}</h1>
      <div className={s.empurra}><a className={`${s.btn} ${s.btnAzul}`} href="/comecar">Criar o meu desafio</a></div></main></Moldura>
  );
  if (!v) return <Moldura><main className={s.tela} aria-busy="true" /></Moldura>;
  if (v.proprio && tela === "desafio") return (
    <Moldura><main className={`${s.tela} ${s.centro}`}><h1 className={s.titulo}>Este desafio <b>é seu.</b></h1>
      <p className={s.lead}>Envie o link para alguém tentar te prever. O resultado aparece em Meus desafios.</p>
      <div className={s.empurra}><a className={`${s.btn} ${s.btnAzul}`} href="/desafios">Ver meus desafios</a></div></main></Moldura>
  );

  if (tela === "desafio") return (
    <Moldura>
      <main className={s.tela}>
        <div className={s.globoTopo}><Globo opcoes={{ pontos: 1100, pessoas: 18, arcos: 9, escala: 0.38, velocidade: 0.003, montagem: 1.2, deslocamento: 0.02 }} /></div>
        <div style={{ display: "flex", justifyContent: "center", margin: "-66px 0 16px", position: "relative" }}><Inicial nome={v.nome} ambar tamanho={84} /></div>
        <div className={s.centro}><span className={s.chipRelacao}>{{ familia: "Desafio de família", amigos: "Desafio de amigos", crush: "Desafio de crush" }[v.relacao]}</span></div>
        <h1 className={`${s.titulo} ${s.centro}`}>{v.nome} <b>te desafiou.</b></h1>
        <p className={`${s.lead} ${s.centro}`}>{v.nome} respondeu 10 perguntas sobre si. Quanto você acha que conhece essa pessoa?</p>
        {conta ? <p className={s.miudo} style={{ marginBottom: 14 }}><Icone nome="ok" />Você vai responder como <b style={{ color: "var(--tinta)", marginLeft: 4 }}>{conta.nome}</b>.</p> : <div className={s.campo}>
          <label htmlFor="meu-nome">Como {v.nome} te chama?</label>
          <input id="meu-nome" autoComplete="given-name" maxLength={24} placeholder="Seu primeiro nome" value={meuNome} onChange={(e) => setMeuNome(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && meuNome.trim().length >= 2) setTela("prever"); }} />
        </div>}
        <p className={s.miudo}><Icone nome="escudo" />Sem cadastro. Seu nome aparece para {v.nome} junto com o placar. Você não vê as respostas de {v.nome}, e {v.nome} não vê as suas escolhas.</p>
        <div className={s.empurra}><button className={`${s.btn} ${s.btnAzul}`} type="button" disabled={nomeFinal.trim().length < 2} onClick={() => setTela("prever")}>Aceitar o desafio<Icone nome="seta" /></button></div>
      </main>
    </Moldura>
  );

  if (tela === "prever") {
    const q = v.perguntas[i]!, feitas = prev.filter((x) => x !== undefined).length;
    return (
      <Moldura modoB aoVoltar={() => (i > 0 ? setI(i - 1) : setTela("desafio"))}>
        <main className={s.tela} key={`p${i}`}>
          <div className={`${s.progresso} ${s.progressoB}`} aria-hidden="true">{v.perguntas.map((p, k) => <i key={p.chave} className={k < feitas ? s.feito : ""} />)}</div>
          <Anel nome={v.nome} feitas={feitas} atual={i} ambar />
          <span className={s.quemResp}>Como {v.nome} responderia?</span>
          <h2 className={s.pergunta} id={`prev-${i}`}>{q.texto}</h2>
          <div className={s.opcoes} role="radiogroup" aria-labelledby={`prev-${i}`}>
            {q.opcoes.map((o, k) => (
              <button key={o} className={`${s.op} ${prev[i] === k ? s.opSel : ""}`} type="button" role="radio" aria-checked={prev[i] === k} onClick={() => escolher(k)}>
                <span className={s.letra}>{LETRAS[k]}</span>{o}
              </button>
            ))}
          </div>
          <p className={`${s.miudo} ${s.rodapeQ}`}><Icone nome="relogio" />Pergunta {i + 1} de {v.perguntas.length}. O placar sai no final.</p>
        </main>
      </Moldura>
    );
  }

  const acertos = placar?.acertos ?? 0;
  return (
    <Moldura>
      <main className={`${s.tela} ${s.centro}`}>
        <div className={s.radarGrande}><Radar acertos={acertos} visivel={contagem > 0 || acertos === 0} /><Inicial nome={v.nome} ambar tamanho={88} /></div>
        <div className={s.placar}>{contagem}<small> de {placar?.total ?? 10}</small></div>
        <p className={s.veredito}>{veredito(acertos, v.nome)}</p>
        <p className={s.lead}>{v.nome} vai ver o seu placar quando entrar no orvok.</p>
        <div className={s.empurra}>
          <button className={`${s.btn} ${s.btnAzul}`} type="button" onClick={() => router.push(`/comecar?volta=${encodeURIComponent(v.nome)}&de=${encodeURIComponent(codigo)}`)}><Icone nome="alvo" />Agora é a sua vez</button>
          <p className={s.miudo} style={{ justifyContent: "center" }}>Responda sobre você e veja se {v.nome} te conhece tão bem assim.</p>
        </div>
      </main>
    </Moldura>
  );
}
