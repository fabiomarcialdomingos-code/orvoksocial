"use client";
/* As fotos e os desenhos são privados e vêm de rotas com autorização: não passam pelo otimizador de imagens. */
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Moldura } from "../desafio/pecas";
import { CONSENTIMENTO_IDADE } from "./Estante";
import { Avatar, Desenho, ErroApi, Escala, chamar, urlDaFoto } from "./cliente";
import e from "./estante.module.css";

function Cadastro({ nome, setNome, idade, setIdade }: { nome: string; setNome: (v: string) => void; idade: boolean; setIdade: (v: boolean) => void }) {
  return (
    <div className={e.cartao}>
      <div className={e.campo}><label htmlFor="nome-r">Como as pessoas te chamam?</label><input id="nome-r" type="text" maxLength={24} value={nome} onChange={(x) => setNome(x.target.value)} autoComplete="given-name" /></div>
      <label className={e.consent}><input type="checkbox" checked={idade} onChange={(x) => setIdade(x.target.checked)} /><span>Confirmo ter pelo menos 16 anos e aceito os <a href="/termos" target="_blank" rel="noopener noreferrer">Termos de uso</a> e a <a href="/privacidade" target="_blank" rel="noopener noreferrer">Política de privacidade</a>.</span></label>
    </div>
  );
}

type Previa = { objeto: string; ilustracao: string | null; de: string; jaAberto: boolean };
type Aberta = { id: string; objeto: string; frase: string | null; ilustracao: string | null; foto: string | null; de: string; deId: string; reacao: number | null };

/** O link de um presente: mostra o objeto e quem deu; quem abre primeiro fica com a lembrança. */
export function Presente({ codigo }: { codigo: string }) {
  const [previa, setPrevia] = useState<Previa | null | "sumiu">(null);
  const [temPessoa, setTemPessoa] = useState<boolean | null>(null);
  const [aberta, setAberta] = useState<Aberta | null>(null);
  const [nome, setNome] = useState("");
  const [idade, setIdade] = useState(false);
  const [nota, setNota] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    chamar<{ presente: Previa }>(`presente/${codigo}`).then((r) => setPrevia(r.presente)).catch(() => setPrevia("sumiu"));
    chamar<{ pessoa: unknown }>("eu").then((r) => setTemPessoa(r.pessoa !== null)).catch(() => setTemPessoa(false));
  }, [codigo]);

  if (previa === null || temPessoa === null) return <Moldura><p className={e.pagina} aria-busy="true">Abrindo…</p></Moldura>;
  if (previa === "sumiu") return <Moldura><div className={e.pagina}><h1 className={e.titulo}>Esta lembrança não está mais aqui</h1><p className={e.lead}>O link pode estar errado, ou quem mandou recolheu a lembrança.</p></div></Moldura>;

  const abrir = async () => {
    setOcupado(true); setErro(null);
    try { setAberta((await chamar<{ presente: Aberta }>(`presente/${codigo}`, { corpo: temPessoa ? {} : { nome: nome.trim(), consentimentoIdade: CONSENTIMENTO_IDADE } })).presente); }
    catch (x) { setErro(x instanceof ErroApi && x.codigo === "CONFLICT" ? "Esta lembrança já foi aberta por outra pessoa, ou foi você quem a deu." : x instanceof ErroApi ? x.texto : "Não foi possível abrir."); }
    setOcupado(false);
  };

  if (!aberta) return (
    <Moldura>
      <div className={e.pagina}>
        <Desenho svg={previa.ilustracao} titulo={previa.objeto} grande />
        <h1 className={e.titulo} style={{ textAlign: "center" }}>{previa.de} lembrou de você</h1>
        <p className={e.lead} style={{ textAlign: "center" }}>Guardou <b>{previa.objeto}</b> para você.</p>
        {!temPessoa ? <Cadastro nome={nome} setNome={setNome} idade={idade} setIdade={setIdade} /> : null}
        {erro ? <p className={e.erro} role="alert">{erro}</p> : null}
        <button className={`${e.btn} ${e.btnPrincipal} ${e.btnLargo}`} type="button" disabled={ocupado || (!temPessoa && (!idade || !nome.trim()))} onClick={abrir}>{ocupado ? "Abrindo…" : "Abrir e guardar na minha estante"}</button>
        <p className={e.miudo} style={{ textAlign: "center" }}>Quem abre primeiro fica com a lembrança. É de graça e não precisa de cadastro.</p>
      </div>
    </Moldura>
  );

  return (
    <Moldura>
      <div className={e.pagina}>
        <Desenho svg={aberta.ilustracao ?? previa.ilustracao} titulo={aberta.objeto} grande />
        <h1 className={e.titulo} style={{ textAlign: "center" }}>{aberta.objeto}</h1>
        <p className={e.miudo} style={{ textAlign: "center" }}>lembrança de {aberta.de}</p>
        {aberta.frase ? <p className={e.frase}>{aberta.frase}</p> : null}
        {aberta.foto ? <><img className={e.foto} src={urlDaFoto(aberta.foto)} alt={`Foto de ${aberta.objeto}`} /><a className={e.btn} href={urlDaFoto(aberta.foto, true)}>Baixar a foto</a></> : null}
        <div className={e.campo}>
          <span className={e.rotulo}>{(nota ?? aberta.reacao) === null ? `O quanto você gostou? ${aberta.de} vai saber.` : `Obrigado. ${aberta.de} vai saber.`}</span>
          <Escala valor={nota ?? aberta.reacao} desativado={(nota ?? aberta.reacao) !== null} aoEscolher={async (n) => {
            try { await chamar(`lembrancas/${aberta.id}/reagir`, { corpo: { nota: n } }); setNota(n); } catch (x) { setErro(x instanceof ErroApi ? x.texto : "Não foi possível."); }
          }} />
        </div>
        {erro ? <p className={e.erro} role="alert">{erro}</p> : null}
        <div className={e.linha} style={{ justifyContent: "center" }}>
          <Link className={`${e.btn} ${e.btnPrincipal}`} href={`/estante/mandar?para=${aberta.deId}`} prefetch={false}>Lembrar de {aberta.de} também</Link>
          <Link className={e.btn} href="/estante" prefetch={false}>Ver a minha estante</Link>
        </div>
      </div>
    </Moldura>
  );
}

/** O link de convite para o círculo de alguém. */
export function ConviteCirculo({ codigo }: { codigo: string }) {
  const roteador = useRouter();
  const [quem, setQuem] = useState<string | null | "sumiu">(null);
  const [temPessoa, setTemPessoa] = useState<boolean | null>(null);
  const [nome, setNome] = useState("");
  const [idade, setIdade] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    chamar<{ convite: { nome: string } }>(`convite/${codigo}`).then((r) => setQuem(r.convite.nome)).catch(() => setQuem("sumiu"));
    chamar<{ pessoa: unknown }>("eu").then((r) => setTemPessoa(r.pessoa !== null)).catch(() => setTemPessoa(false));
  }, [codigo]);
  if (quem === null || temPessoa === null) return <Moldura><p className={e.pagina} aria-busy="true">Abrindo…</p></Moldura>;
  if (quem === "sumiu") return <Moldura><div className={e.pagina}><h1 className={e.titulo}>Este convite não existe</h1><p className={e.lead}>Confira o link com quem te mandou.</p></div></Moldura>;
  return (
    <Moldura>
      <div className={e.pagina}>
        <div className={e.cabeca} style={{ justifyContent: "center" }}><Avatar id={null} nome={quem} tamanho={72} /></div>
        <h1 className={e.titulo} style={{ textAlign: "center" }}>{quem} quer você no círculo</h1>
        <p className={e.lead} style={{ textAlign: "center" }}>No círculo, vocês veem a estante um do outro e podem guardar lembranças. Só quem é do círculo vê.</p>
        {!temPessoa ? <Cadastro nome={nome} setNome={setNome} idade={idade} setIdade={setIdade} /> : null}
        {erro ? <p className={e.erro} role="alert">{erro}</p> : null}
        <button className={`${e.btn} ${e.btnPrincipal} ${e.btnLargo}`} type="button" disabled={ocupado || (!temPessoa && (!idade || !nome.trim()))} onClick={async () => {
          setOcupado(true); setErro(null);
          try { await chamar(`convite/${codigo}`, { corpo: temPessoa ? {} : { nome: nome.trim(), consentimentoIdade: CONSENTIMENTO_IDADE } }); roteador.push("/estante"); }
          catch (x) { setErro(x instanceof ErroApi && x.codigo === "CONFLICT" ? "Este é o seu próprio link." : x instanceof ErroApi ? x.texto : "Não foi possível entrar."); setOcupado(false); }
        }}>Entrar no círculo</button>
      </div>
    </Moldura>
  );
}

type Visita = { dono: { id: string; nome: string; avatar: string | null }; objetos: { id: string; objeto: string; ilustracao: string | null; de: string; frase: string | null; foto: string | null }[] };
/** A estante de alguém do círculo. */
export function EstanteDe({ id }: { id: string }) {
  const [v, setV] = useState<Visita | null | "sem">(null);
  const [marcou, setMarcou] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => { chamar<{ estante: Visita }>(`pessoas/${id}`).then((r) => setV(r.estante)).catch(() => setV("sem")); }, [id]);
  if (v === null) return <Moldura><p className={e.pagina} aria-busy="true">Abrindo…</p></Moldura>;
  if (v === "sem") return <Moldura><div className={e.pagina}><h1 className={e.titulo}>Não dá para ver esta estante</h1><p className={e.lead}>Só quem é do círculo da pessoa vê a estante dela.</p><Link className={e.btn} href="/estante" prefetch={false}>Voltar</Link></div></Moldura>;
  return (
    <Moldura>
      <div className={e.pagina}>
        <div className={e.cabeca}><Avatar id={v.dono.avatar} nome={v.dono.nome} tamanho={56} /><div><b>A estante de {v.dono.nome}</b><span>{v.objetos.length} {v.objetos.length === 1 ? "lembrança" : "lembranças"}</span></div></div>
        <div className={e.linha}>
          <button className={`${e.btn} ${e.btnPrincipal}`} type="button" disabled={marcou} onClick={async () => { try { await chamar(`pessoas/${id}/marcar`, { corpo: {} }); setMarcou(true); } catch (x) { setErro(x instanceof ErroApi ? x.texto : "Não foi possível."); } }}>{marcou ? "Você passou por aqui" : "Passei por aqui"}</button>
          <Link className={e.btn} href={`/estante/mandar?para=${v.dono.id}`} prefetch={false}>Lembrei de você</Link>
        </div>
        {erro ? <p className={e.erro} role="alert">{erro}</p> : null}
        {v.objetos.length === 0 ? <div className={e.vazio}><b>A estante ainda está vazia.</b><span>Que tal ser o primeiro a guardar algo?</span></div> : (
          <div className={e.estante}>
            {v.objetos.map((o) => <div key={o.id} className={e.objeto} style={{ cursor: "default" }}><Desenho svg={o.ilustracao} titulo={o.objeto} /><b>{o.objeto}</b><small>de {o.de}</small>{o.frase ? <small style={{ color: "var(--tinta)" }}>{o.frase}</small> : null}</div>)}
          </div>
        )}
        <Link className={e.btnTexto} style={{ justifySelf: "center" }} href="/estante" prefetch={false}>Voltar à minha estante</Link>
      </div>
    </Moldura>
  );
}
