"use client";
import { useEffect, useState } from "react";
import { ROTULO_CATEGORIA, fraseEstado, quandoRevela, type Rodada } from "../../lib/client/mundo";
import { Icone, Inicial, Moldura, enviarJson, estilos as s, useConta } from "./pecas";

const AVISO_IDADE = { aceito: true, versao: "desafio-aceitar-idade-v1" } as const;

/** Página do convidado de uma rodada do Mundo (sem conta). */
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
      if (!x.ok) { setFalha(x.status === 404 ? "Esta rodada não existe mais." : x.status === 403 ? "Esta rodada já foi respondida por outra pessoa." : "Não foi possível abrir agora."); return; }
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
    if (!x.ok) { setFalha(x.dados.code === "OWN_CHALLENGE" ? "Esta rodada é sua. Mande o link para outra pessoa." : x.status === 409 ? "Esta rodada já fechou para respostas." : "Não foi possível registrar agora."); return; }
    setR(x.dados.rodada);
  };

  if (falha) return <Moldura><main className={`${s.tela} ${s.centro}`}><h1 className={s.titulo}>{falha}</h1><div className={s.empurra}><a className={`${s.btn} ${s.btnAzul}`} href="/comecar">Conhecer o orvok</a></div></main></Moldura>;
  if (!r) return <Moldura><main className={s.tela} aria-busy="true" /></Moldura>;

  const adivinhar = r.modo === "ser_previsto";
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
                <p>{r.quemResponde} respondeu: <b>{r.revelacao.resposta}</b>. {r.revelacao.naoSei ? `${r.quemAdivinha} escolheu "não sei".` : `${r.quemAdivinha} previu: ${r.revelacao.palpite}.`}</p>
                <p className={s.miudo}>Resultado do evento: {r.evento.resultado ?? "ainda não informado"}. Acertar a resposta da pessoa é diferente de acertar o resultado do evento.</p>
              </div>
            ) : <p className={`${s.miudo}`} style={{ justifyContent: "center" }}><Icone nome="relogio" />{fraseEstado(r)}</p>}
            {r.minhaResposta ? <p className={s.miudo} style={{ justifyContent: "center" }}>Sua resposta: {r.minhaResposta}</p> : null}
            {r.meuPalpite ? <p className={s.miudo} style={{ justifyContent: "center" }}>Seu palpite: {r.meuPalpite}</p> : null}
            <div className={s.empurra}>
              <a className={`${s.btn} ${s.btnAzul}`} href="/entrar?returnTo=%2Feventos">Criar uma rodada minha</a>
              <a className={`${s.btn} ${s.btnFio}`} href="/comecar">Criar o meu retrato</a>
            </div>
          </>
        ) : (
          <>
            <h1 className={`${s.titulo} ${s.centro}`}>{adivinhar ? <>{r.criador} respondeu. <b>Você adivinha?</b></> : <>{r.criador} quer adivinhar <b>a sua opinião.</b></>}</h1>
            <p className={`${s.lead} ${s.centro}`}>{r.evento.titulo}</p>
            <p className={s.miudo} style={{ justifyContent: "center", marginBottom: 12 }}><Icone nome="escudo" />{adivinhar
              ? `Você não está prevendo o evento: está tentando adivinhar o que ${r.criador} respondeu.`
              : `Responda o que você acha. ${r.criador} vai tentar adivinhar.`} O resultado sai {quandoRevela(r.evento.encerraEm)}.</p>
            <div className={s.opcoes} role="radiogroup" aria-label="Opções">
              {r.evento.opcoes.map((o) => (
                <button key={o.id} type="button" role="radio" aria-checked={escolha === o.id} className={`${s.op} ${escolha === o.id ? s.opSel : ""}`} onClick={() => setEscolha(o.id)}>
                  {adivinhar ? `${r.criador} respondeu: ${o.rotulo}` : o.rotulo}
                </button>
              ))}
              {adivinhar ? <button type="button" role="radio" aria-checked={escolha === null} className={`${s.op} ${escolha === null ? s.opSel : ""}`} onClick={() => setEscolha(null)}>Não sei</button> : null}
            </div>
            {conta ? null : <div className={s.campo} style={{ marginTop: 14 }}><label htmlFor="nome-rodada">Como {r.criador} te chama?</label><input id="nome-rodada" maxLength={24} placeholder="Seu primeiro nome" value={nome} onChange={(e) => setNome(e.target.value)} /></div>}
            <label className={s.consent} style={{ marginTop: 10 }}>
              <input type="checkbox" checked={idade} onChange={(e) => setIdade(e.target.checked)} />
              <span>Confirmo ter pelo menos 16 anos e aceito os <a className="text-link" href="/termos" target="_blank" rel="noopener noreferrer">Termos de uso</a> e a <a className="text-link" href="/privacidade" target="_blank" rel="noopener noreferrer">Política de privacidade</a>.</span>
            </label>
            <div className={s.empurra}>
              <button className={`${s.btn} ${s.btnAzul}`} type="button" disabled={escolha === undefined || !idade || nomeFinal.trim().length < 2 || ocupado} onClick={() => void enviar()}>{adivinhar ? "Registrar meu palpite" : "Registrar minha resposta"}<Icone nome="seta" /></button>
            </div>
          </>
        )}
      </main>
    </Moldura>
  );
}
