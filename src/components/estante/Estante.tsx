"use client";
/* As fotos e os desenhos são privados e vêm de rotas com autorização: não passam pelo otimizador de imagens. */
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AVISO_IDADE_HASH, AVISO_IDADE_VERSAO } from "@/lib/desafio/catalogo";
import { Moldura } from "../desafio/pecas";
import { Avatar, Desenho, ErroApi, Escala, chamar, linkWhatsApp, origem, reduzirFoto, urlDaFoto, useMensagem } from "./cliente";
import e from "./estante.module.css";

type Objeto = { id: string; objeto: string; frase: string | null; ilustracao: string | null; foto: string | null; de: string; reacao: number | null; em: string; podeReagir: boolean };
type Enviada = { id: string; codigo: string; objeto: string; ilustracao: string | null; foto: string | null; para: string | null; aberta: boolean; previsto: number; reacao: number | null; frase?: string };
type Pessoa = { id: string; nome: string; avatar: string | null };
type Dados = {
  pessoa: { id: string; nome: string; convite: string; avatar: string | null } | null;
  estante: { objetos: Objeto[]; visitas: { naSemana: number; passaramPorAqui: { nome: string; dia: string }[] } } | null;
  circulo: { convite: string | null; avatar: string | null; pessoas: Pessoa[] };
  enviadas: Enviada[];
  albuns: { deQuem: { pessoaId: string; nome: string; quantidade: number }[]; anos: { ano: number; quantidade: number }[]; amadas: number; vocesDois: { pessoaId: string; nome: string; quantidade: number }[] } | null;
  fotos: boolean;
};
type ItemAlbum = { id: string; objeto: string; frase: string | null; ilustracao: string | null; foto: string | null; de: string; para: string; souEuQuemDeu: boolean; reacao: number | null; em: string };
const VAZIO: Dados = { pessoa: null, estante: null, circulo: { convite: null, avatar: null, pessoas: [] }, enviadas: [], albuns: null, fotos: false };
type Aba = "estante" | "enviadas" | "circulo" | "albuns";

/** Cor de fundo da prateleira conforme a hora: a luz muda ao longo do dia (a das 18h é a de chegar em casa). */
function luzDoDia(h: number): string {
  if (h >= 5 && h < 10) return "radial-gradient(120% 90% at 50% 0%, rgb(127 178 255 / .20), transparent 70%)";
  if (h >= 10 && h < 16) return "radial-gradient(120% 90% at 50% 0%, rgb(234 240 250 / .12), transparent 70%)";
  if (h >= 16 && h < 20) return "radial-gradient(120% 90% at 50% 0%, rgb(255 168 52 / .26), transparent 70%)";
  return "radial-gradient(120% 90% at 50% 0%, rgb(76 141 255 / .12), transparent 70%)";
}

export function CadastroEstante({ aoCriar, rotulo = "Criar a minha estante" }: { aoCriar: (nome: string) => Promise<void>; rotulo?: string }) {
  const [nome, setNome] = useState("");
  const [idade, setIdade] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  return (
    <div className={e.cartao}>
      <div className={e.campo}><label htmlFor="nome-estante">Como as pessoas te chamam?</label><input id="nome-estante" type="text" maxLength={24} value={nome} onChange={(x) => setNome(x.target.value)} autoComplete="given-name" /></div>
      <label className={e.consent}><input type="checkbox" checked={idade} onChange={(x) => setIdade(x.target.checked)} /><span>Confirmo ter pelo menos 16 anos e aceito os <a href="/termos" target="_blank" rel="noopener noreferrer">Termos de uso</a> e a <a href="/privacidade" target="_blank" rel="noopener noreferrer">Política de privacidade</a>.</span></label>
      {erro ? <p className={e.erro} role="alert">{erro}</p> : null}
      <button className={`${e.btn} ${e.btnPrincipal} ${e.btnLargo}`} type="button" disabled={ocupado || !idade || !nome.trim()} onClick={async () => {
        setOcupado(true); setErro(null);
        try { await aoCriar(nome.trim()); } catch (x) { setErro(x instanceof ErroApi ? x.texto : "Não foi possível agora."); }
        setOcupado(false);
      }}>{rotulo}</button>
    </div>
  );
}
export const CONSENTIMENTO_IDADE = { aceito: true, versao: AVISO_IDADE_VERSAO, hash: AVISO_IDADE_HASH } as const;

export function Estante() {
  const [d, setD] = useState<Dados | null>(null);
  const [aba, setAba] = useState<Aba>("estante");
  const [aberto, setAberto] = useState<Objeto | null>(null);
  const [msg, setMsg] = useMensagem();
  const [luz] = useState(() => luzDoDia(new Date().getHours()));
  const [album, setAlbum] = useState<{ titulo: string; itens: ItemAlbum[] } | null>(null);
  const arquivo = useRef<HTMLInputElement>(null);
  const tentouDesenhar = useRef(new Set<string>());

  const carregar = useCallback(async () => {
    try { setD(await chamar<Dados>("eu")); } catch { setD(VAZIO); }
  }, []);
  useEffect(() => {
    let ativo = true;
    chamar<Dados>("eu").then((x) => { if (ativo) setD(x); }).catch(() => { if (ativo) setD(VAZIO); });
    return () => { ativo = false; };
  }, []);

  // Os objetos sem desenho pedem o seu, um de cada vez.
  useEffect(() => {
    if (!d?.estante) return;
    const faltando = d.estante.objetos.filter((o) => !o.ilustracao && !tentouDesenhar.current.has(o.id)).slice(0, 4);
    if (!faltando.length) return;
    let ativo = true;
    (async () => {
      for (const o of faltando) {
        tentouDesenhar.current.add(o.id);
        try {
          const r = await chamar<{ ilustracao: string | null }>(`lembrancas/${o.id}/ilustrar`, { corpo: {} });
          if (ativo && r.ilustracao) setD((x) => x && x.estante ? { ...x, estante: { ...x.estante, objetos: x.estante.objetos.map((y) => (y.id === o.id ? { ...y, ilustracao: r.ilustracao } : y)) } } : x);
        } catch { /* o desenho de reserva continua */ }
      }
    })();
    return () => { ativo = false; };
  }, [d]);

  if (!d) return <Moldura><p className={e.pagina} aria-busy="true">Abrindo a sua estante…</p></Moldura>;

  if (!d.pessoa) return (
    <Moldura>
      <div className={e.pagina}>
        <h1 className={e.titulo}>A sua estante</h1>
        <p className={e.lead}>Quando alguém lembra de você, guarda um objeto aqui, com uma frase. Você vê o que as pessoas associam a você, e elas descobrem o quanto o gesto foi bem recebido.</p>
        <CadastroEstante aoCriar={async (nome) => { await chamar("pessoa", { corpo: { nome, consentimentoIdade: CONSENTIMENTO_IDADE } }); await carregar(); }} />
      </div>
    </Moldura>
  );

  const eu = d.pessoa, objetos = d.estante?.objetos ?? [], visitas = d.estante?.visitas;
  const linkConvite = `${origem()}/v/${eu.convite}`;
  const trocarFoto = async (f: File | undefined) => {
    if (!f) return;
    try {
      const b = await reduzirFoto(f, 800);
      const r = await chamar<{ id: string }>("imagens?finalidade=avatar", { bruto: b });
      await chamar("avatar", { corpo: { imageId: r.id } });
      await carregar();
    } catch (x) { setMsg(x instanceof ErroApi ? x.texto : "Não foi possível trocar a foto."); }
  };
  const abrirAlbum = async (titulo: string, consulta: string) => {
    try { setAlbum({ titulo, itens: (await chamar<{ itens: ItemAlbum[] }>(`album?${consulta}`)).itens }); } catch (x) { setMsg(x instanceof ErroApi ? x.texto : "Não foi possível abrir."); }
  };

  return (
    <Moldura>
      <div className={e.pagina}>
        <div className={e.cabeca}>
          <button type="button" className={e.btnTexto} style={{ textDecoration: "none" }} onClick={() => arquivo.current?.click()} aria-label="Trocar a foto de perfil"><Avatar id={eu.avatar} nome={eu.nome} tamanho={56} /></button>
          <input ref={arquivo} type="file" accept="image/*" hidden onChange={(x) => { void trocarFoto(x.target.files?.[0]); x.target.value = ""; }} />
          <div><b>{eu.nome}</b><span>{objetos.length} {objetos.length === 1 ? "lembrança" : "lembranças"}</span></div>
        </div>
        {msg ? <p className={e.erro} role="alert">{msg}</p> : null}
        <div className={e.linha}>
          <Link className={`${e.btn} ${e.btnPrincipal}`} href="/estante/mandar" prefetch={false}>Lembrei de você</Link>
          <button className={e.btn} type="button" onClick={async () => { try { await navigator.clipboard.writeText(linkConvite); setMsg("Link copiado."); } catch { setMsg(linkConvite); } }}>Convidar para o círculo</button>
        </div>

        <div className={e.abas} role="tablist">
          {([["estante", "Estante"], ["enviadas", "Enviadas"], ["circulo", "Círculo"], ["albuns", "Álbuns"]] as const).map(([k, r]) => (
            <button key={k} type="button" role="tab" aria-selected={aba === k} className={`${e.aba} ${aba === k ? e.abaAtiva : ""}`} onClick={() => { setAba(k); setAlbum(null); }}>{r}</button>
          ))}
        </div>

        {aba === "estante" ? (
          <>
            {visitas && (visitas.naSemana > 0 || visitas.passaramPorAqui.length > 0) ? (
              <div className={e.faixa}>
                {visitas.naSemana} {visitas.naSemana === 1 ? "visita" : "visitas"} esta semana.{visitas.passaramPorAqui.length ? ` Passaram por aqui: ${[...new Set(visitas.passaramPorAqui.map((p) => p.nome))].join(", ")}.` : ""}
              </div>
            ) : null}
            {objetos.length === 0 ? (
              <div className={e.vazio}><b>Ainda não tem nada aqui.</b><span>Convide pessoas para o seu círculo. Quando alguém lembrar de você, o objeto aparece nesta estante.</span></div>
            ) : (
              <div className={e.estante} style={{ background: luz, borderRadius: 20, padding: 4 }}>
                {objetos.map((o) => (
                  <button key={o.id} type="button" className={`${e.objeto} ${o.podeReagir ? e.novo : ""}`} onClick={() => setAberto(o)}>
                    <Desenho svg={o.ilustracao} titulo={o.objeto} />
                    <b>{o.objeto}</b><small>de {o.de}</small>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : null}

        {aba === "enviadas" ? (
          d.enviadas.length === 0 ? <div className={e.vazio}><b>Você ainda não mandou nada.</b><span>Quando algo lembrar de alguém, guarde na estante da pessoa.</span></div> : (
            <ul className={e.lista}>
              {d.enviadas.map((x) => (
                <li key={x.id} className={e.item}>
                  <Desenho svg={x.ilustracao} titulo={x.objeto} />
                  <div>
                    <b>{x.objeto}</b>
                    <span>para {x.para ?? "alguém"} · você achou {x.previsto}{x.reacao !== null ? `, ${x.reacao}` : ""}</span>
                    {x.reacao !== null && x.frase ? <p className={e.comparacao}>{x.frase}</p> : <p>{x.aberta ? "Ainda sem reação." : "Ainda não foi aberta."}</p>}
                    <div className={e.linha} style={{ marginTop: 8 }}>
                      {!x.aberta ? <button type="button" className={e.chip} onClick={async () => { const link = `${origem()}/l/${x.codigo}`; try { await navigator.clipboard.writeText(link); setMsg("Link copiado."); } catch { setMsg(link); } }}>Copiar link</button> : null}
                      {!x.aberta ? <a className={e.chip} style={{ textDecoration: "none" }} target="_blank" rel="noopener noreferrer" href={linkWhatsApp(`Lembrei de você: guardei "${x.objeto}" para você. ${origem()}/l/${x.codigo}`)}>WhatsApp</a> : null}
                      {x.reacao === null ? <button type="button" className={e.btnTexto} onClick={async () => { try { await chamar(`lembrancas/${x.id}/recolher`, { corpo: {} }); await carregar(); } catch (er) { setMsg(er instanceof ErroApi ? er.texto : "Não foi possível."); } }}>Recolher</button> : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )
        ) : null}

        {aba === "circulo" ? (
          <>
            <p className={e.miudo}>O círculo são as pessoas que se conhecem. Só elas veem a sua estante.</p>
            {d.circulo.pessoas.length === 0 ? <div className={e.vazio}><b>Seu círculo está vazio.</b><span>Copie o link e mande para quem importa.</span></div> : (
              <ul className={e.lista}>
                {d.circulo.pessoas.map((p) => (
                  <li key={p.id} className={e.pessoa}>
                    <Avatar id={p.avatar} nome={p.nome} /><b>{p.nome}</b>
                    <div className={e.linha}>
                      <Link className={e.chip} style={{ textDecoration: "none" }} href={`/estante/de/${p.id}`} prefetch={false}>Ver estante</Link>
                      <Link className={e.chip} style={{ textDecoration: "none" }} href={`/estante/mandar?para=${p.id}`} prefetch={false}>Lembrei de você</Link>
                      <button type="button" className={e.btnTexto} onClick={async () => { if (!window.confirm(`Bloquear ${p.nome}? Vocês deixam de se ver e de trocar lembranças.`)) return; try { await chamar(`pessoas/${p.id}/bloquear`, { corpo: {} }); await carregar(); } catch (er) { setMsg(er instanceof ErroApi ? er.texto : "Não foi possível."); } }}>Bloquear</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className={e.linha}>
              <button className={e.btn} type="button" onClick={async () => { try { await navigator.clipboard.writeText(linkConvite); setMsg("Link copiado."); } catch { setMsg(linkConvite); } }}>Copiar o meu link</button>
              <a className={e.btn} target="_blank" rel="noopener noreferrer" href={linkWhatsApp(`Entra no meu círculo no orvok: ${linkConvite}`)}>Mandar por WhatsApp</a>
            </div>
          </>
        ) : null}

        {aba === "albuns" ? (
          !d.albuns || (d.albuns.deQuem.length === 0 && d.albuns.vocesDois.length === 0) ? <div className={e.vazio}><b>Os álbuns se montam sozinhos.</b><span>Quando chegarem as primeiras lembranças, eles aparecem aqui.</span></div> : (
            <>
              {d.albuns.vocesDois.length ? <><b className={e.rotulo}>O álbum de vocês dois</b><div className={e.chips}>{d.albuns.vocesDois.map((x) => <button key={x.pessoaId} type="button" className={e.chip} onClick={() => abrirAlbum(`Você e ${x.nome}`, `tipo=vocesDois&pessoaId=${x.pessoaId}`)}>{x.nome} · {x.quantidade}</button>)}</div></> : null}
              {d.albuns.deQuem.length ? <><b className={e.rotulo}>De quem</b><div className={e.chips}>{d.albuns.deQuem.map((x) => <button key={x.pessoaId} type="button" className={e.chip} onClick={() => abrirAlbum(`De ${x.nome}`, `tipo=de&pessoaId=${x.pessoaId}`)}>{x.nome} · {x.quantidade}</button>)}</div></> : null}
              <b className={e.rotulo}>Outros</b>
              <div className={e.chips}>
                {d.albuns.amadas ? <button type="button" className={e.chip} onClick={() => abrirAlbum("As que mais te tocaram", "tipo=amadas")}>As mais amadas · {d.albuns.amadas}</button> : null}
                {d.albuns.anos.map((x) => <button key={x.ano} type="button" className={e.chip} onClick={() => abrirAlbum(String(x.ano), `tipo=ano&ano=${x.ano}`)}>{x.ano} · {x.quantidade}</button>)}
              </div>
              {album ? (
                <div className={e.cartao}>
                  <b>{album.titulo}</b>
                  <ul className={e.lista}>
                    {album.itens.map((i) => (
                      <li key={i.id} className={e.item}>
                        <Desenho svg={i.ilustracao} titulo={i.objeto} />
                        <div><b>{i.objeto}</b><span>{i.souEuQuemDeu ? `você → ${i.para}` : `${i.de} → você`}</span>{i.frase ? <p>{i.frase}</p> : null}
                          {i.foto ? <a className={e.chip} style={{ textDecoration: "none" }} href={urlDaFoto(i.foto, true)}>Baixar foto</a> : null}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          )
        ) : null}
      </div>

      {aberto ? <Detalhe objeto={aberto} aoFechar={() => setAberto(null)} aoMudar={async () => { setAberto(null); await carregar(); }} /> : null}
    </Moldura>
  );
}

function Detalhe({ objeto, aoFechar, aoMudar }: { objeto: Objeto; aoFechar: () => void; aoMudar: () => Promise<void> }) {
  const [nota, setNota] = useState<number | null>(objeto.reacao);
  const [erro, setErro] = useState<string | null>(null);
  const [agradecido, setAgradecido] = useState(false);
  return (
    <div className={e.fundo} role="dialog" aria-modal="true" aria-label={objeto.objeto} onClick={(x) => { if (x.target === x.currentTarget) aoFechar(); }}>
      <div className={e.folha}>
        <Desenho svg={objeto.ilustracao} titulo={objeto.objeto} grande />
        <h2>{objeto.objeto}</h2>
        <p className={e.miudo} style={{ textAlign: "center" }}>lembrança de {objeto.de}</p>
        {objeto.frase ? <p className={e.frase}>{objeto.frase}</p> : null}
        {objeto.foto ? <><img className={e.foto} src={urlDaFoto(objeto.foto)} alt={`Foto de ${objeto.objeto}`} /><a className={e.btn} href={urlDaFoto(objeto.foto, true)}>Baixar a foto</a></> : null}
        <div className={e.campo}>
          <span className={e.rotulo}>{nota === null ? `O quanto você gostou? ${objeto.de} vai saber.` : agradecido ? `Obrigado. ${objeto.de} vai saber.` : "Você já reagiu a esta lembrança."}</span>
          <Escala valor={nota} desativado={!objeto.podeReagir || nota !== null} aoEscolher={async (n) => {
            setErro(null);
            try { await chamar(`lembrancas/${objeto.id}/reagir`, { corpo: { nota: n } }); setNota(n); setAgradecido(true); } catch (x) { setErro(x instanceof ErroApi ? x.texto : "Não foi possível."); }
          }} />
        </div>
        {erro ? <p className={e.erro} role="alert">{erro}</p> : null}
        <div className={e.linha} style={{ justifyContent: "space-between" }}>
          <button type="button" className={e.btnTexto} onClick={async () => { try { await chamar(`lembrancas/${objeto.id}/ocultar`, { corpo: {} }); await aoMudar(); } catch (x) { setErro(x instanceof ErroApi ? x.texto : "Não foi possível."); } }}>Esconder da minha estante</button>
          <button type="button" className={e.btn} onClick={async () => { if (agradecido) await aoMudar(); else aoFechar(); }}>Fechar</button>
        </div>
      </div>
    </div>
  );
}
