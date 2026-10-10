"use client";
import { useEffect, useRef, useState } from "react";
import { PASSOS_STORIES, urlCompartilhar } from "@/lib/desafio/mensagens";
import s from "./desafio.module.css";
import { Icone, enviarJson } from "./pecas";

export type CanalMedido = "whatsapp" | "menu" | "facebook" | "stories" | "copiar";

/** Conta qual canal foi usado (só o nome do canal e o código do convite; nunca nome nem mensagem). Nunca atrapalha a ação. */
export function medirCompartilhamento(canal: CanalMedido, codigo: string): void {
  void enviarJson("/api/v1/medicao", { passo: `compartilhar_${canal}`, codigo }).catch(() => undefined);
}

/**
 * Painel para convidar mais pessoas, pelo canal que cada uma usa. WhatsApp e Facebook abrem direto; "Instagram e outros apps"
 * usa o menu de compartilhar do celular com o card do convite anexado (Instagram direto, Messenger, Telegram, e-mail…);
 * Stories do Instagram não tem atalho oficial pela web, então o painel baixa o card vertical, copia o link e mostra 3 passos.
 */
export function PainelCompartilhar({ codigo, link, mensagem }: { codigo: string; link: string; mensagem: string }) {
  const [aviso, setAviso] = useState<string | null>(null);
  const [stories, setStories] = useState(false);
  const [baixando, setBaixando] = useState(false);
  const cartao = useRef<File | null>(null);

  // O card é buscado antes do toque: o menu de compartilhar do celular só aceita o arquivo se o toque ainda estiver "fresco".
  useEffect(() => {
    let ativo = true;
    void fetch(`/d/${codigo}/cartao`).then((r) => (r.ok ? r.blob() : null)).then((b) => { if (ativo && b) cartao.current = new File([b], "convite-orvok.png", { type: "image/png" }); }).catch(() => undefined);
    return () => { ativo = false; };
  }, [codigo]);

  const copiar = async (): Promise<boolean> => {
    try { await navigator.clipboard.writeText(`${mensagem} ${link}`); return true; } catch { return false; }
  };
  const copiarLink = async () => {
    medirCompartilhamento("copiar", codigo);
    setAviso((await copiar()) ? "Mensagem e link copiados." : "Não consegui copiar. Segure o link para copiar.");
  };
  const whatsapp = () => { medirCompartilhamento("whatsapp", codigo); window.open(urlCompartilhar("whatsapp", link, mensagem), "_blank", "noopener"); };
  const facebook = () => { medirCompartilhamento("facebook", codigo); window.open(urlCompartilhar("facebook", link, mensagem), "_blank", "noopener"); };
  const menu = async () => {
    medirCompartilhamento("menu", codigo);
    const arquivo = cartao.current;
    const comArquivo = Boolean(arquivo && navigator.canShare?.({ files: [arquivo!] }));
    const dados: ShareData = comArquivo ? { files: [arquivo!], text: `${mensagem} ${link}` } : { text: mensagem, url: link };
    if (navigator.share) { await navigator.share(dados).catch(() => undefined); return; }
    setAviso((await copiar()) ? "Seu navegador não tem menu de compartilhar. Copiei a mensagem e o link." : "Seu navegador não tem menu de compartilhar.");
  };
  const baixarStories = async () => {
    medirCompartilhamento("stories", codigo);
    setBaixando(true); setAviso(null);
    const copiou = await copiar();
    try {
      const r = await fetch(`/d/${codigo}/cartao?formato=stories`);
      if (!r.ok) throw new Error();
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement("a");
      a.href = url; a.download = "convite-orvok-stories.png"; document.body.appendChild(a); a.click(); a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setAviso(copiou ? "Card baixado e link copiado. Agora siga os passos." : "Card baixado. O link não foi copiado: use o botão Copiar.");
    } catch { setAviso("Não foi possível preparar o card agora. Tente de novo."); }
    setBaixando(false);
  };

  return (
    <section className={s.oferta} aria-label="Convidar mais pessoas">
      <h2>Convide mais pessoas</h2>
      <p>Cada pessoa usa um canal diferente. O card do convite aparece junto com o link.</p>
      <button className={`${s.btn} ${s.btnAzul}`} type="button" onClick={whatsapp}><Icone nome="conversa" />WhatsApp</button>
      <div className={s.linhaBtn}>
        <button className={`${s.btn} ${s.btnFio}`} type="button" onClick={facebook}><Icone nome="pessoas" />Facebook</button>
        <button className={`${s.btn} ${s.btnFio}`} type="button" onClick={() => void copiarLink()}><Icone nome="copiar" />Copiar</button>
      </div>
      <button className={`${s.btn} ${s.btnFio}`} type="button" onClick={() => void menu()}><Icone nome="enviar" />Instagram e outros apps</button>
      <button className={`${s.btn} ${s.btnFio}`} type="button" aria-expanded={stories} onClick={() => setStories(!stories)}><Icone nome="mais" />Stories do Instagram</button>
      {stories ? (
        <div className={s.passosStories}>
          <ol>{PASSOS_STORIES.map((p) => <li key={p}>{p}</li>)}</ol>
          <button className={`${s.btn} ${s.btnAzul}`} type="button" disabled={baixando} onClick={() => void baixarStories()}>{baixando ? "Preparando o card…" : "Baixar o card e copiar o link"}</button>
        </div>
      ) : null}
      {aviso ? <p role="status" className={s.miudo}>{aviso}</p> : null}
    </section>
  );
}
