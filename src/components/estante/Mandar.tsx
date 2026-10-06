"use client";
/* As fotos e os desenhos são privados e vêm de rotas com autorização: não passam pelo otimizador de imagens. */
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useEffect, useState } from "react";
import { Moldura } from "../desafio/pecas";
import { CONSENTIMENTO_IDADE } from "./Estante";
import { Desenho, ErroApi, Escala, chamar, linkWhatsApp, origem, reduzirFoto } from "./cliente";
import e from "./estante.module.css";

type Eu = { pessoa: { nome: string } | null; circulo: { pessoas: { id: string; nome: string }[] }; fotos: boolean };
type Resultado = { id: string; codigo: string; tipo: "direta" | "presente"; ilustracao: string | null; para: string; objeto: string };

/** "Lembrei de você": escolher a pessoa, o objeto, uma frase, uma foto (opcional) e prever o quanto ela vai gostar. */
export function Mandar({ para }: { para: string | null }) {
  const [eu, setEu] = useState<Eu | null>(null);
  const [destino, setDestino] = useState<string>(para ?? "");
  const [nomeFora, setNomeFora] = useState("");
  const [titulo, setTitulo] = useState("");
  const [frase, setFrase] = useState("");
  const [previsao, setPrevisao] = useState<number | null>(null);
  const [foto, setFoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [nome, setNome] = useState("");
  const [idade, setIdade] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [res, setRes] = useState<Resultado | null>(null);

  useEffect(() => { chamar<Eu>("eu").then(setEu).catch(() => setEu({ pessoa: null, circulo: { pessoas: [] }, fotos: false })); }, []);
  useEffect(() => () => { if (foto) URL.revokeObjectURL(foto.url); }, [foto]);
  if (!eu) return <Moldura><p className={e.pagina} aria-busy="true">Preparando…</p></Moldura>;

  const gente = eu.circulo.pessoas;
  const fora = destino === "fora" || (gente.length === 0 && destino === "");
  const alvoOk = fora ? nomeFora.trim().length > 0 : destino !== "";
  const cadastroOk = eu.pessoa !== null || (nome.trim().length > 0 && idade);
  const pronto = alvoOk && titulo.trim().length > 0 && previsao !== null && cadastroOk;

  const enviar = async () => {
    setOcupado(true); setErro(null);
    try {
      if (!eu.pessoa) await chamar("pessoa", { corpo: { nome: nome.trim(), consentimentoIdade: CONSENTIMENTO_IDADE } });
      let imageId: string | undefined;
      if (foto) imageId = (await chamar<{ id: string }>("imagens?finalidade=keepsake", { bruto: foto.blob })).id;
      const r = await chamar<{ id: string; codigo: string; tipo: "direta" | "presente" }>("lembrancas", { corpo: {
        ...(fora ? { paraNome: nomeFora.trim() } : { paraPessoaId: destino }), titulo: titulo.trim(), ...(frase.trim() ? { frase: frase.trim() } : {}), previsao, ...(imageId ? { imageId } : {}),
      } });
      let ilustracao: string | null = null;
      try { ilustracao = (await chamar<{ ilustracao: string | null }>(`lembrancas/${r.id}/ilustrar`, { corpo: {} })).ilustracao; } catch { /* o desenho de reserva serve */ }
      setRes({ ...r, ilustracao, para: fora ? nomeFora.trim() : (gente.find((p) => p.id === destino)?.nome ?? ""), objeto: titulo.trim() });
    } catch (x) { setErro(x instanceof ErroApi ? x.texto : "Não foi possível enviar agora."); }
    setOcupado(false);
  };

  if (res) {
    const link = `${origem()}/l/${res.codigo}`;
    return (
      <Moldura>
        <div className={e.pagina}>
          <Desenho svg={res.ilustracao} titulo={res.objeto} grande />
          <h1 className={e.titulo} style={{ textAlign: "center" }}>{res.tipo === "direta" ? `Guardado na estante de ${res.para}` : `Um presente para ${res.para}`}</h1>
          {res.tipo === "direta" ? (
            <p className={e.lead} style={{ textAlign: "center" }}>{res.para} vai receber um aviso. Quando reagir, você descobre o quanto gostou, e se foi mais do que você imaginou.</p>
          ) : (
            <>
              <p className={e.lead} style={{ textAlign: "center" }}>{res.para} ainda não está no orvok. Mande este link: quem abrir primeiro fica com a lembrança.</p>
              <div className={e.linha} style={{ justifyContent: "center" }}>
                <a className={`${e.btn} ${e.btnPrincipal}`} target="_blank" rel="noopener noreferrer" href={linkWhatsApp(`Lembrei de você: guardei "${res.objeto}" para você. ${link}`)}>Mandar por WhatsApp</a>
                <button className={e.btn} type="button" onClick={async () => { try { await navigator.clipboard.writeText(link); setErro(null); } catch { setErro(link); } }}>Copiar o link</button>
              </div>
            </>
          )}
          {erro ? <p className={e.ok} role="status">{erro}</p> : null}
          <div className={e.linha} style={{ justifyContent: "center" }}>
            <Link className={e.btn} href="/estante" prefetch={false}>Ver a minha estante</Link>
            <button className={e.btn} type="button" onClick={() => { setRes(null); setTitulo(""); setFrase(""); setPrevisao(null); setFoto(null); }}>Mandar outra</button>
          </div>
        </div>
      </Moldura>
    );
  }

  return (
    <Moldura>
      <div className={e.pagina}>
        <h1 className={e.titulo}>Lembrei de você</h1>
        <p className={e.lead}>Algo te lembrou de alguém? Guarde na estante da pessoa.</p>

        <div className={e.campo}>
          <span className={e.rotulo}>Para quem?</span>
          <div className={e.escolhas}>
            {gente.map((p) => <button key={p.id} type="button" className={`${e.escolha} ${destino === p.id ? e.escolhaSel : ""}`} onClick={() => setDestino(p.id)}>{p.nome}</button>)}
            <button type="button" className={`${e.escolha} ${fora ? e.escolhaSel : ""}`} onClick={() => setDestino("fora")}>Alguém que ainda não está no orvok</button>
          </div>
          {fora ? <input type="text" maxLength={24} placeholder="Como ela se chama?" value={nomeFora} onChange={(x) => setNomeFora(x.target.value)} aria-label="Nome da pessoa" style={{ border: "1px solid var(--fio-2)", background: "var(--sup-2)", color: "var(--tinta)", borderRadius: 14, padding: "12px 14px", font: "inherit", boxSizing: "border-box", width: "100%" }} /> : null}
        </div>

        <div className={e.campo}><label htmlFor="obj">O que lembrou de você?</label><input id="obj" type="text" maxLength={60} placeholder="Ex.: um violão, o mar de Ubatuba, aquele café" value={titulo} onChange={(x) => setTitulo(x.target.value)} /></div>
        <div className={e.campo}><label htmlFor="frase">Uma frase (opcional)</label><textarea id="frase" maxLength={240} placeholder="Só a pessoa e você leem isto." value={frase} onChange={(x) => setFrase(x.target.value)} /><small>{frase.length}/240</small></div>

        {eu.fotos ? (
          <div className={e.campo}>
            <span className={e.rotulo}>Uma foto (opcional)</span>
            {foto ? (
              <div className={e.linha}><img className={e.fotoPrevia} src={foto.url} alt="Prévia da foto" /><button type="button" className={e.btnTexto} onClick={() => setFoto(null)}>Tirar a foto</button></div>
            ) : (
              <input type="file" accept="image/*" onChange={async (x) => {
                const f = x.target.files?.[0]; if (!f) return;
                try { const blob = await reduzirFoto(f, 1600); setFoto({ blob, url: URL.createObjectURL(blob) }); setErro(null); } catch (er) { setErro(er instanceof ErroApi ? er.texto : "Não foi possível usar esta foto."); }
              }} />
            )}
            <p className={e.miudo}>A foto é só entre você e a pessoa. As outras pessoas veem apenas o desenho do objeto.</p>
          </div>
        ) : null}

        <div className={e.campo}>
          <span className={e.rotulo}>O quanto você acha que ela vai gostar?</span>
          <Escala valor={previsao} aoEscolher={setPrevisao} />
          <p className={e.miudo}>Depois que ela reagir, você descobre a diferença.</p>
        </div>

        {!eu.pessoa ? (
          <div className={e.cartao}>
            <div className={e.campo}><label htmlFor="meunome">Como as pessoas te chamam?</label><input id="meunome" type="text" maxLength={24} value={nome} onChange={(x) => setNome(x.target.value)} autoComplete="given-name" /></div>
            <label className={e.consent}><input type="checkbox" checked={idade} onChange={(x) => setIdade(x.target.checked)} /><span>Confirmo ter pelo menos 16 anos e aceito os <a href="/termos" target="_blank" rel="noopener noreferrer">Termos de uso</a> e a <a href="/privacidade" target="_blank" rel="noopener noreferrer">Política de privacidade</a>.</span></label>
          </div>
        ) : null}

        {erro ? <p className={e.erro} role="alert">{erro}</p> : null}
        <button className={`${e.btn} ${e.btnPrincipal} ${e.btnLargo}`} type="button" disabled={!pronto || ocupado} onClick={enviar}>{ocupado ? "Enviando…" : "Guardar a lembrança"}</button>
        <Link className={e.btnTexto} style={{ justifySelf: "center" }} href="/estante" prefetch={false}>Voltar à estante</Link>
      </div>
    </Moldura>
  );
}
