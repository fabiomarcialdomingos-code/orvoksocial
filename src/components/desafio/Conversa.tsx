"use client";
import { useCallback, useEffect, useState } from "react";
import c from "./conversa.module.css";

type Estado = {
  liberada: boolean; outra: string | null; precisaIdade: boolean; avisoIdade: { versao: string; hash: string } | null; status: "PROPOSED" | "ACCEPTED" | "DECLINED" | "CLOSED" | null;
  proposta: "voce" | "outra" | null; mensagens: { minha: boolean; texto: string; em: string }[];
};

const MENSAGENS_ERRO: Record<string, string> = {
  RATE_LIMITED: "Muitas mensagens em pouco tempo. Tente de novo mais tarde.",
  CONFLICT: "Esta conversa não aceita isso agora.",
};

/**
 * Conversa depois da revelação do Mundo. Funciona para quem tem conta e para
 * quem entrou sem cadastro (pelo mesmo aparelho). Só existe entre as duas
 * pessoas da conversa; o primeiro contato precisa ser aceito.
 */
export function Conversa({ codigo }: { codigo: string }) {
  const [e, setE] = useState<Estado | null>(null);
  const [texto, setTexto] = useState("");
  const [motivo, setMotivo] = useState("");
  const [denunciando, setDenunciando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [idade, setIdade] = useState(false);
  const url = `/api/v1/mundo/rodadas/${encodeURIComponent(codigo)}/conversa`;

  const buscar = useCallback(async (): Promise<Estado | null> => {
    const r = await fetch(url, { credentials: "same-origin", cache: "no-store" }).catch(() => null);
    return r?.ok ? ((await r.json()) as { conversa: Estado }).conversa : null;
  }, [url]);
  const carregar = useCallback(async () => { const x = await buscar(); if (x) setE(x); }, [buscar]);
  useEffect(() => {
    let ativo = true;
    void buscar().then((x) => { if (ativo && x) setE(x); });
    return () => { ativo = false; };
  }, [buscar]);

  const confirmarIdade = async () => {
    if (!e?.avisoIdade) return;
    setOcupado(true); setErro(null);
    const res = await fetch(url, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acao: "confirmar_idade", consentimentoIdade: { aceito: true, versao: e.avisoIdade.versao, hash: e.avisoIdade.hash } }) }).catch(() => null);
    setOcupado(false);
    if (!res?.ok) { setErro("Não foi possível confirmar agora. Tente de novo."); return; }
    await carregar();
  };

  const agir = async (corpo: Record<string, string>) => {
    setOcupado(true); setErro(null);
    const r = await fetch(url, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) }).catch(() => null);
    setOcupado(false);
    if (!r?.ok) { const d = (await r?.json().catch(() => null)) as { code?: string } | null; setErro(MENSAGENS_ERRO[d?.code ?? ""] ?? "Não foi possível agora. Tente de novo."); return false; }
    await carregar();
    return true;
  };

  if (!e || !e.liberada) return null;
  const outra = e.outra ?? "a outra pessoa";

  if (e.precisaIdade) return (
    <div className={c.caixa}>
      <p className={c.titulo}>Antes de conversar</p>
      <label className={c.nota} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <input type="checkbox" checked={idade} onChange={(ev) => setIdade(ev.target.checked)} style={{ marginTop: 3 }} />
        <span>Confirmo ter pelo menos 16 anos e aceito os <a className="text-link" href="/termos" target="_blank" rel="noopener noreferrer">Termos de uso</a> e a <a className="text-link" href="/privacidade" target="_blank" rel="noopener noreferrer">Política de privacidade</a>. Você só confirma isso uma vez.</span>
      </label>
      <div className={c.acoes}><button className={`${c.btn} ${c.principal}`} type="button" disabled={ocupado || !idade} onClick={() => void confirmarIdade()}>Confirmar</button></div>
      {erro ? <p className={c.erro} role="alert">{erro}</p> : null}
    </div>
  );

  if (!e.status) return (
    <div className={c.caixa}>
      <p className={c.titulo}>Quer conversar sobre isso?</p>
      <p className={c.nota}>Vocês dois já deram a opinião. Se {outra} aceitar, abre uma conversa privada só entre vocês dois.</p>
      <div className={c.acoes}><button className={`${c.btn} ${c.principal}`} type="button" disabled={ocupado} onClick={() => void agir({ acao: "propor" })}>Propor uma conversa</button></div>
      {erro ? <p className={c.erro} role="alert">{erro}</p> : null}
    </div>
  );
  if (e.status === "PROPOSED") return (
    <div className={c.caixa}>
      {e.proposta === "voce" ? (
        <><p className={c.titulo}>Aguardando {outra}</p><p className={c.nota}>Você propôs uma conversa. Ela só começa se {outra} aceitar.</p>
          <div className={c.acoes}><button className={c.btn} type="button" disabled={ocupado} onClick={() => void agir({ acao: "encerrar" })}>Cancelar</button></div></>
      ) : (
        <><p className={c.titulo}>{outra} gostaria de conversar sobre isso</p><p className={c.nota}>Será uma conversa privada só entre vocês dois. Você pode encerrar quando quiser.</p>
          <div className={c.acoes}>
            <button className={`${c.btn} ${c.principal}`} type="button" disabled={ocupado} onClick={() => void agir({ acao: "aceitar" })}>Aceitar</button>
            <button className={c.btn} type="button" disabled={ocupado} onClick={() => void agir({ acao: "recusar" })}>Agora não</button>
          </div></>
      )}
      {erro ? <p className={c.erro} role="alert">{erro}</p> : null}
    </div>
  );
  if (e.status === "DECLINED" || e.status === "CLOSED") return (
    <div className={c.caixa}>
      <p className={c.nota}>{e.status === "DECLINED" ? "A conversa não foi aceita." : "Esta conversa foi encerrada."}</p>
      {e.mensagens.length ? <div className={c.fio} aria-label="Mensagens">{e.mensagens.map((m, k) => <div key={k} className={`${c.msg} ${m.minha ? c.minha : c.dela}`}>{m.texto}</div>)}</div> : null}
    </div>
  );
  return (
    <div className={c.caixa}>
      <p className={c.titulo}>Conversa com {outra}</p>
      <p className={c.nota}>Privada, só entre vocês dois. As mensagens são apagadas depois de 90 dias.</p>
      {e.mensagens.length ? (
        <div className={c.fio} aria-label="Mensagens">
          {e.mensagens.map((m, k) => (
            <div key={k} className={`${c.msg} ${m.minha ? c.minha : c.dela}`}>{m.texto}<span className={c.hora}>{new Date(m.em).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</span></div>
          ))}
        </div>
      ) : <p className={c.nota}>Comece contando o que você pensou.</p>}
      <div className={c.campo}>
        <label className={c.nota} htmlFor={`msg-${codigo}`}>Sua mensagem</label>
        <textarea id={`msg-${codigo}`} maxLength={1000} value={texto} onChange={(ev) => setTexto(ev.target.value)} />
        <span className={c.contador}>{texto.length}/1000</span>
        <div className={c.acoes}>
          <button className={`${c.btn} ${c.principal}`} type="button" disabled={ocupado || !texto.trim()} onClick={async () => { if (await agir({ acao: "enviar", texto: texto.trim() })) setTexto(""); }}>Enviar</button>
          <button className={c.btn} type="button" disabled={ocupado} onClick={() => void agir({ acao: "encerrar" })}>Encerrar conversa</button>
        </div>
      </div>
      {denunciando ? (
        <div className={c.campo}>
          <label className={c.nota} htmlFor={`den-${codigo}`}>O que aconteceu? A nossa equipe só lê a conversa por causa da denúncia.</label>
          <textarea id={`den-${codigo}`} maxLength={1000} value={motivo} onChange={(ev) => setMotivo(ev.target.value)} />
          <div className={c.acoes}>
            <button className={c.btn} type="button" disabled={ocupado || !motivo.trim()} onClick={async () => { if (await agir({ acao: "denunciar", motivo: motivo.trim() })) { setDenunciando(false); setMotivo(""); setErro("Denúncia enviada. Vamos revisar."); } }}>Enviar denúncia</button>
            <button className={c.btn} type="button" onClick={() => setDenunciando(false)}>Cancelar</button>
          </div>
        </div>
      ) : <button className={c.discreto} type="button" onClick={() => setDenunciando(true)}>Denunciar esta conversa</button>}
      {erro ? <p className={c.erro} role="alert">{erro}</p> : null}
    </div>
  );
}
