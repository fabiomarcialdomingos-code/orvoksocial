"use client";
import { useEffect, useState } from "react";
import { ROTULO_CATEGORIA, fraseEstado, quandoRevela, type Rodada } from "../../lib/client/mundo";
import { Icone, Inicial, Moldura, enviarJson, estilos as s, useConta } from "./pecas";

const AVISO_IDADE = { aceito: true, versao: "desafio-aceitar-idade-v1" } as const;

/** Página de quem foi convidado para uma conversa do Mundo (sem conta). */
export function FluxoRodada({ codigo, hashIdade }: { codigo: string; hashIdade: string }) {
  const [r, setR] = useState<Rodada | null>(null);
  const [falha, setFalha] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [idade, setIdade] = useState(false);
  const [escolha, setEscolha] = useState<string | null | undefined>(undefined);
  const [ocupado, setOcupado] = useState(false);
  const conta = useConta();
  const nomeFinal = conta?.nome ?? nome;

  useEffect(() => {
    void fetch(`/api/v1/mundo/r/${encodeURIComponent(codigo)}`, { credentials: "same-origin", cache: "no-store" }).then(async (x) => {
      if (!x.ok) { setFalha(x.status === 404 ? "Esta conversa não existe mais." : x.status === 403 ? "Esta conversa já foi aberta por outra pessoa." : "Não foi possível abrir agora."); return; }
      const d = (await x.json()) as { rodada: Rodada };
      setR(d.rodada);
      if (d.rodada.estado === "revelada") void enviarJson("/api/v1/medicao", { passo: "mundo_revelacao_vista", codigo });
    });
  }, [codigo]);

  const enviar = async () => {
    if (escolha === undefined || ocupado) return;
    setOcupado(true);
    const x = await enviarJson<{ rodada: Rodada }>(`/api/v1/mundo/r/${encodeURIComponent(codigo)}`, { nome: nomeFinal.trim(), opcao: escolha, consentimentoIdade: { ...AVISO_IDADE, hash: hashIdade } });
    setOcupado(false);
    if (!x.ok) { setFalha(x.dados.code === "OWN_CHALLENGE" ? "Esta conversa é sua. Mande o link para outra pessoa." : x.status === 409 ? "Esta conversa já fechou para respostas." : "Não foi possível registrar agora."); return; }
    setR(x.dados.rodada);
  };

  if (falha) return <Moldura><main className={`${s.tela} ${s.centro}`}><h1 className={s.titulo}>{falha}</h1><div className={s.empurra}><a className={`${s.btn} ${s.btnAzul}`} href="/comecar">Conhecer o orvok</a></div></main></Moldura>;
  if (!r) return <Moldura><main className={s.tela} aria-busy="true" /></Moldura>;

  const segunda = r.modo === "ser_previsto"; // este convidado responde depois de quem criou
  const final = !r.minhaVez;
  return (
    <Moldura>
      <main className={s.tela}>
        <div style={{ display: "flex", justifyContent: "center", margin: "8px 0 14px" }}><Inicial nome={r.criador} ambar tamanho={76} /></div>
        <div className={s.centro}><span className={s.chipRelacao}>{ROTULO_CATEGORIA[r.evento.categoria] ?? "Mundo"}</span></div>
        {final ? (
          <>
            <h1 className={`${s.titulo} ${s.centro}`}>{r.estado === "revelada" ? <>Resultado <b>liberado.</b></> : <>Tudo <b>registrado.</b></>}</h1>
            <p className={`${s.lead} ${s.centro}`}>{r.evento.titulo}</p>
            {r.revelacao ? (
              <div className={s.oferta} style={{ textAlign: "left" }}>
                <h2>{fraseEstado(r)}</h2>
                <p>{r.primeiro} acha: <b>{r.revelacao.primeiraOpiniao}</b>. {r.revelacao.semOpiniao ? `${r.segundo} preferiu não opinar.` : `${r.segundo} acha: ${r.revelacao.segundaOpiniao}.`}</p>
                <p className={s.miudo}>Resultado do evento: {r.evento.resultado ?? "ainda não informado"}. Pensar igual a alguém é diferente de quem estava certo sobre o evento.</p>
              </div>
            ) : <p className={`${s.miudo}`} style={{ justifyContent: "center" }}><Icone nome="relogio" />{fraseEstado(r)}</p>}
            {r.minhaOpiniao ? <p className={s.miudo} style={{ justifyContent: "center" }}>Sua opinião: {r.minhaOpiniao}</p> : null}
            <div className={s.empurra}>
              <a className={`${s.btn} ${s.btnAzul}`} href="/entrar?returnTo=%2Feventos">Abrir uma conversa minha</a>
              <a className={`${s.btn} ${s.btnFio}`} href="/comecar">Criar o meu retrato</a>
            </div>
          </>
        ) : (
          <>
            <h1 className={`${s.titulo} ${s.centro}`}>{segunda ? <>{r.criador} já respondeu. <b>E você, o que acha?</b></> : <>{r.criador} quer saber <b>o que você acha.</b></>}</h1>
            <p className={`${s.lead} ${s.centro}`}>{r.evento.titulo}</p>
            <p className={s.miudo} style={{ justifyContent: "center", marginBottom: 12 }}><Icone nome="escudo" />Cada um responde em segredo o que acha que vai acontecer. Quando o evento terminar, vocês descobrem se pensaram igual. A revelação sai {quandoRevela(r.evento.encerraEm)}.</p>
            <div className={s.opcoes} role="radiogroup" aria-label="Opções">
              {r.evento.opcoes.map((o) => (
                <button key={o.id} type="button" role="radio" aria-checked={escolha === o.id} className={`${s.op} ${escolha === o.id ? s.opSel : ""}`} onClick={() => setEscolha(o.id)}>{o.rotulo}</button>
              ))}
              {segunda ? <button type="button" role="radio" aria-checked={escolha === null} className={`${s.op} ${escolha === null ? s.opSel : ""}`} onClick={() => setEscolha(null)}>Prefiro não opinar</button> : null}
            </div>
            {conta ? null : <div className={s.campo} style={{ marginTop: 14 }}><label htmlFor="nome-rodada">Como {r.criador} te chama?</label><input id="nome-rodada" maxLength={24} placeholder="Seu primeiro nome" value={nome} onChange={(e) => setNome(e.target.value)} /></div>}
            <label className={s.consent} style={{ marginTop: 10 }}>
              <input type="checkbox" checked={idade} onChange={(e) => setIdade(e.target.checked)} />
              <span>Confirmo ter pelo menos 16 anos e aceito os <a className="text-link" href="/termos" target="_blank" rel="noopener noreferrer">Termos de uso</a> e a <a className="text-link" href="/privacidade" target="_blank" rel="noopener noreferrer">Política de privacidade</a>.</span>
            </label>
            <div className={s.empurra}>
              <button className={`${s.btn} ${s.btnAzul}`} type="button" disabled={escolha === undefined || !idade || nomeFinal.trim().length < 2 || ocupado} onClick={() => void enviar()}>Registrar a minha opinião<Icone nome="seta" /></button>
            </div>
          </>
        )}
      </main>
    </Moldura>
  );
}
