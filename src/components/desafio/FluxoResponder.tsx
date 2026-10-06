"use client";
import { useEffect, useState } from "react";
import { Globo } from "./Globo";
import { Anel, Icone, Inicial, Moldura, enviarJson, estilos as s, guardarNomeNoPerfil, useConta } from "./pecas";

type Pergunta = { chave: string; texto: string; opcoes: string[] };
type AvisoIdade = { versao: string; hash: string; texto: string };
type Vitrine = { nome: string; proprio: boolean; perguntas: Pergunta[]; jaRespondeu: boolean; avisoIdade: AvisoIdade };
type MiniResultado = { poucosDados: true } | { poucosDados: false; bateram: number; deTotal: number };
const LETRAS = ["A", "B", "C", "D"] as const;

/** Percurso de quem recebe o convite: compartilha como enxerga a pessoa, sem cadastro e sem certo ou errado. */
export function FluxoResponder({ codigo }: { codigo: string }) {
  const [v, setV] = useState<Vitrine | null>(null);
  const [falha, setFalha] = useState<string | null>(null);
  const [tela, setTela] = useState<"convite" | "responder" | "obrigado">("convite");
  const [i, setI] = useState(0);
  const [respostas, setRespostas] = useState<(number | undefined)[]>([]);
  const [mini, setMini] = useState<MiniResultado | null>(null);
  const [meuNome, setMeuNome] = useState("");
  const [aceitoIdade, setAceitoIdade] = useState(false);
  const [acao, setAcao] = useState<"nenhuma" | "denunciar" | "confirmarBloqueio" | "bloqueado">("nenhuma");
  const [motivoDenuncia, setMotivoDenuncia] = useState("");
  const [denunciaEnviada, setDenunciaEnviada] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const conta = useConta();
  const nomeFinal = conta?.nome ?? meuNome;

  useEffect(() => {
    void fetch(`/api/v1/desafio/${encodeURIComponent(codigo)}`).then(async (r) => {
      if (!r.ok) {
        const corpo = (await r.json().catch(() => null)) as { code?: string } | null;
        setFalha(
          r.status === 404 ? "Este convite não existe mais ou expirou."
            : corpo?.code === "BLOCKED" ? "Você bloqueou quem te enviou este convite."
            : "Não foi possível abrir o convite agora.",
        );
        return;
      }
      const d = (await r.json()) as Vitrine;
      setV(d);
      if (d.jaRespondeu) setTela("obrigado");
    }).catch(() => setFalha("Não foi possível abrir o convite agora."));
  }, [codigo]);

  const concluir = async (lista: (number | undefined)[]) => {
    if (!v) return;
    const r = await enviarJson<{ miniResultado: MiniResultado }>(`/api/v1/desafio/${encodeURIComponent(codigo)}/tentativa`, {
      nome: nomeFinal.trim(), avisoRetrato: "retrato-opiniao-v1", previsoes: lista.map((x) => LETRAS[x ?? 0]),
      consentimentoIdade: { aceito: true, versao: v.avisoIdade.versao, hash: v.avisoIdade.hash },
    });
    if (!r.ok) { setFalha(r.dados.code === "OWN_CHALLENGE" ? "Este convite é seu. Envie o link para alguém compartilhar como te vê." : "Não foi possível registrar agora. Tente de novo."); return; }
    if (conta && !conta.nome) guardarNomeNoPerfil(nomeFinal);
    setMini(r.dados.miniResultado);
    setTela("obrigado");
  };
  const escolher = (k: number) => {
    const novas = [...respostas]; novas[i] = k; setRespostas(novas);
    window.setTimeout(() => { if (v && i < v.perguntas.length - 1) setI(i + 1); else void concluir(novas); }, 380);
  };
  const enviarDenuncia = async () => {
    if (!motivoDenuncia.trim() || ocupado) return;
    setOcupado(true);
    const r = await enviarJson(`/api/v1/desafio/${encodeURIComponent(codigo)}/denunciar`, { motivo: motivoDenuncia.trim() });
    setOcupado(false);
    if (r.ok) setDenunciaEnviada(true);
  };
  const confirmarBloqueio = async () => {
    if (ocupado) return;
    setOcupado(true);
    const r = await enviarJson(`/api/v1/desafio/${encodeURIComponent(codigo)}/bloquear`, {});
    setOcupado(false);
    if (r.ok) setAcao("bloqueado");
  };

  if (falha) return (
    <Moldura><main className={`${s.tela} ${s.centro}`}><h1 className={s.titulo}>{falha}</h1>
      <div className={s.empurra}><a className={`${s.btn} ${s.btnAzul}`} href="/comecar">Criar o meu retrato</a></div></main></Moldura>
  );
  if (!v) return <Moldura><main className={s.tela} aria-busy="true" /></Moldura>;
  if (v.proprio && tela === "convite") return (
    <Moldura><main className={`${s.tela} ${s.centro}`}><h1 className={s.titulo}>Este convite <b>é seu.</b></h1>
      <p className={s.lead}>Envie o link para alguém compartilhar como te vê. O retrato aparece em Meu retrato.</p>
      <div className={s.empurra}><a className={`${s.btn} ${s.btnAzul}`} href="/retrato">Ver meu retrato</a></div></main></Moldura>
  );

  if (acao === "bloqueado") return (
    <Moldura><main className={`${s.tela} ${s.centro}`}>
      <h1 className={s.titulo}><b>{v.nome}</b> foi bloqueado.</h1>
      <p className={s.lead}>Essa pessoa não vai conseguir te enviar novos convites. Isso não muda nada para quem mais recebeu o mesmo link.</p>
      <div className={s.empurra}><a className={`${s.btn} ${s.btnAzul}`} href="/comecar">Criar o meu retrato</a></div>
    </main></Moldura>
  );

  if (tela === "convite") return (
    <Moldura>
      <main className={s.tela}>
        <div className={s.globoTopo}><Globo opcoes={{ pontos: 1100, pessoas: 18, arcos: 9, escala: 0.38, velocidade: 0.003, montagem: 1.2, deslocamento: 0.02 }} /></div>
        <div style={{ display: "flex", justifyContent: "center", margin: "-66px 0 16px", position: "relative" }}><Inicial nome={v.nome} ambar tamanho={84} /></div>
        <div className={s.centro}><span className={s.chipRelacao}>Convite</span></div>
        <h1 className={`${s.titulo} ${s.centro}`}>Como você <b>vê {v.nome}?</b></h1>
        <p className={`${s.lead} ${s.centro}`}>{v.nome} gostaria de saber. São {v.perguntas.length} perguntas e não há resposta certa: compartilhe como você enxerga essa pessoa. Ninguém saberá o que você respondeu.</p>
        {conta?.nome ? <p className={s.miudo} style={{ marginBottom: 14 }}><Icone nome="ok" />Você vai responder como <b style={{ color: "var(--tinta)", marginLeft: 4 }}>{conta.nome}</b>.</p> : <div className={s.campo}>
          <label htmlFor="meu-nome">Como {v.nome} te chama?</label>
          <input id="meu-nome" autoComplete="given-name" maxLength={24} placeholder="Seu primeiro nome" value={meuNome} onChange={(e) => setMeuNome(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && meuNome.trim().length >= 2) setTela("responder"); }} />
        </div>}
        <p className={s.miudo}><Icone nome="escudo" />Sem cadastro. Suas respostas entram no retrato de {v.nome} sem o seu nome, e só aparecem quando pelo menos 3 pessoas responderam.</p>
        <label className={s.consent}>
          <input type="checkbox" checked={aceitoIdade} onChange={(e) => setAceitoIdade(e.target.checked)} />
          <span>Confirmo ter pelo menos 16 anos e aceito os <a className="text-link" href="/termos" target="_blank" rel="noopener noreferrer">Termos de uso</a> e a <a className="text-link" href="/privacidade" target="_blank" rel="noopener noreferrer">Política de privacidade</a>.</span>
        </label>
        <div className={s.empurra}>
          <button className={`${s.btn} ${s.btnAzul}`} type="button" disabled={nomeFinal.trim().length < 2 || !aceitoIdade} onClick={() => setTela("responder")}>Responder<Icone nome="seta" /></button>
        </div>

        {acao === "nenhuma" ? (
          <div className={s.acoesModeracao}>
            <button type="button" onClick={() => setAcao("denunciar")}><Icone nome="bandeira" />Denunciar</button>
            <button type="button" onClick={() => setAcao("confirmarBloqueio")}><Icone nome="bloqueado" />Bloquear {v.nome}</button>
          </div>
        ) : null}

        {acao === "denunciar" ? (
          <div className={s.painelModeracao}>
            {denunciaEnviada ? <p className={s.miudo}><Icone nome="ok" />Denúncia enviada. Vamos revisar.</p> : (
              <>
                <div className={s.campo} style={{ marginBottom: 10 }}>
                  <label htmlFor="motivo-denuncia">O que há de errado com este convite?</label>
                  <textarea id="motivo-denuncia" rows={3} maxLength={1000} value={motivoDenuncia} onChange={(e) => setMotivoDenuncia(e.target.value)} placeholder="Conte o que aconteceu" />
                </div>
                <div className={s.linhaBtn}>
                  <button className={`${s.btn} ${s.btnFio}`} type="button" disabled={!motivoDenuncia.trim() || ocupado} onClick={() => void enviarDenuncia()}>Enviar denúncia</button>
                  <button className={`${s.btn} ${s.btnFio}`} type="button" onClick={() => setAcao("nenhuma")}>Cancelar</button>
                </div>
              </>
            )}
          </div>
        ) : null}

        {acao === "confirmarBloqueio" ? (
          <div className={s.painelModeracao}>
            <p className={s.miudo}>Bloquear {v.nome}? Essa pessoa não vai conseguir te enviar novos convites. Isso não afeta quem mais recebeu este link.</p>
            <div className={s.linhaBtn}>
              <button className={`${s.btn} ${s.btnFio}`} type="button" disabled={ocupado} onClick={() => void confirmarBloqueio()}>Sim, bloquear</button>
              <button className={`${s.btn} ${s.btnFio}`} type="button" onClick={() => setAcao("nenhuma")}>Cancelar</button>
            </div>
          </div>
        ) : null}
      </main>
    </Moldura>
  );

  if (tela === "responder") {
    const q = v.perguntas[i]!, feitas = respostas.filter((x) => x !== undefined).length;
    return (
      <Moldura modoB aoVoltar={() => (i > 0 ? setI(i - 1) : setTela("convite"))}>
        <main className={s.tela} key={`p${i}`}>
          <div className={`${s.progresso} ${s.progressoB}`} aria-hidden="true">{v.perguntas.map((p, k) => <i key={p.chave} className={k < feitas ? s.feito : ""} />)}</div>
          <Anel nome={v.nome} feitas={feitas} atual={i} ambar />
          <span className={s.quemResp}>Como você vê {v.nome}?</span>
          <h2 className={s.pergunta} id={`prev-${i}`}>{q.texto}</h2>
          <div className={s.opcoes} role="radiogroup" aria-labelledby={`prev-${i}`}>
            {q.opcoes.map((o, k) => (
              <button key={o} className={`${s.op} ${respostas[i] === k ? s.opSel : ""}`} type="button" role="radio" aria-checked={respostas[i] === k} onClick={() => escolher(k)}>
                <span className={s.letra}>{LETRAS[k]}</span>{o}
              </button>
            ))}
          </div>
          <p className={`${s.miudo} ${s.rodapeQ}`}><Icone nome="relogio" />Pergunta {i + 1} de {v.perguntas.length}. Não há certo ou errado.</p>
        </main>
      </Moldura>
    );
  }

  return (
    <Moldura>
      <main className={`${s.tela} ${s.centro}`}>
        <div className={s.okGrande}><Icone nome="ok" /></div>
        <h1 className={s.titulo}>Obrigado. <b>Sua visão entrou no retrato de {v.nome}.</b></h1>
        <p className={s.lead}>{v.nome} nunca vai saber o que você respondeu. Quando 3 pessoas responderem, aparece como elas enxergam {v.nome}.</p>
        {mini ? (
          <div className={s.oferta}>
            {mini.poucosDados ? (
              <><h2>Você foi uma das primeiras visões</h2><p>Quando mais pessoas responderem, você poderá ver o quanto a sua visão se aproxima da delas.</p></>
            ) : (
              <><h2>Sua visão se aproximou da maioria em {mini.bateram} de {mini.deTotal} traços</h2><p>Em comparação com as outras pessoas que compartilharam como enxergam {v.nome}.</p></>
            )}
          </div>
        ) : null}
        <div className={s.empurra}>
          <a className={`${s.btn} ${s.btnAzul}`} href={`/comecar?volta=${encodeURIComponent(v.nome)}&de=${encodeURIComponent(codigo)}`}><Icone nome="olho" />Agora é a sua vez</a>
          <p className={s.miudo} style={{ justifyContent: "center" }}>Responda sobre você e descubra como {v.nome} te vê.</p>
        </div>
      </main>
    </Moldura>
  );
}
