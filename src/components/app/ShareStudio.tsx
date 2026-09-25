"use client";
/* eslint-disable react-hooks/set-state-in-effect -- data loading effects set state from API responses (same convention as CommandCenter). */

import QRCode from "qrcode";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost, describeError, relativeTime, type Question } from "../../lib/client/api";
import { useShell } from "./AppShell";

type Theme = "noite" | "aurora" | "mineral";
type Link = { id: string; code: string; theme: Theme; teaserQuestionVersionId: string | null; message: string | null; uses: number; maxUses: number; createdAt: string; expiresAt: string; revokedAt: string | null };
type Tone = "desafio" | "leve" | "carinho";

const THEMES: { id: Theme; name: string; bg: string; ink: string; soft: string; accent: string; accent2: string; line: string }[] = [
  { id: "noite", name: "Noite", bg: "#0a1120", ink: "#e8edf3", soft: "#aab6c8", accent: "#6fd6c5", accent2: "#f4b89a", line: "rgba(150,172,212,.22)" },
  { id: "aurora", name: "Aurora", bg: "#1a1230", ink: "#f6ecef", soft: "#c9b8c8", accent: "#f4b89a", accent2: "#a9b3ff", line: "rgba(244,184,154,.25)" },
  { id: "mineral", name: "Mineral", bg: "#eef0ec", ink: "#0f1a2c", soft: "#4d5b70", accent: "#138f7e", accent2: "#c9714a", line: "rgba(15,26,44,.14)" },
];

const TONES: { id: Tone; name: string; write: (first: string, url: string, teaser?: string) => string }[] = [
  { id: "desafio", name: "Desafio", write: (_f, url, t) => `Aposto que você não acerta 8 de 12 sobre mim.${t ? ` Começa por esta: “${t}”` : ""} Topa? ${url}` },
  { id: "leve", name: "Leve", write: (_f, url) => `Respondi 12 perguntas sobre mim no ORVOK. Quer tentar adivinhar as respostas? ${url}` },
  { id: "carinho", name: "Carinho", write: (_f, url) => `Você é uma das pessoas que mais me conhece. Queria ver o quanto você me lê bem: ${url}` },
];

export function ShareStudio({ questions, answered }: { questions: Question[]; answered: number }) {
  const { profile, toast } = useShell();
  const [links, setLinks] = useState<Link[] | null>(null);
  const [theme, setTheme] = useState<Theme>("noite");
  const [teaser, setTeaser] = useState<string>("");
  const [tone, setTone] = useState<Tone>("desafio");
  const [creating, setCreating] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [format, setFormat] = useState<"og" | "story">("og");

  const load = useCallback(async () => {
    const r = await apiGet<{ items: Link[] }>("/radar/share-links");
    setLinks(r.items);
  }, []);
  useEffect(() => { void load().catch(() => setLinks([])); }, [load]);

  const active = links?.find((l) => !l.revokedAt && new Date(l.expiresAt) > new Date() && l.uses < l.maxUses) ?? null;
  useEffect(() => {
    if (active) { setTheme(active.theme); setTeaser(active.teaserQuestionVersionId ?? ""); }
  }, [active]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = active ? `${origin}/c/${active.code}` : "";
  const first = profile?.displayName.split(" ")[0] ?? "Eu";
  const teaserText = questions.find((q) => q.questionVersionId === (active?.teaserQuestionVersionId ?? teaser))?.text;
  const text = useMemo(() => TONES.find((t) => t.id === tone)!.write(first, url, teaserText), [tone, first, url, teaserText]);
  const dirty = active && (active.theme !== theme || (active.teaserQuestionVersionId ?? "") !== teaser);

  useEffect(() => {
    if (!url) { setQr(null); return; }
    QRCode.toString(url, { type: "svg", margin: 0, color: { dark: "#e8edf3", light: "#00000000" } }).then(setQr).catch(() => setQr(null));
  }, [url]);

  const create = async () => {
    setCreating(true);
    try {
      if (active) await apiPost(`/radar/share-links/${active.id}/revoke`, {});
      await apiPost("/radar/share-links", { theme, teaserQuestionVersionId: teaser || null });
      await load();
      toast(active ? "Cartão atualizado. O link anterior foi encerrado." : "Seu convite está pronto para compartilhar.");
    } catch (error) { toast(describeError(error), "error"); } finally { setCreating(false); }
  };

  const copy = async (value: string, label: string) => {
    try { await navigator.clipboard.writeText(value); toast(`${label} copiado.`); } catch { toast("Não foi possível copiar. Selecione e copie manualmente.", "error"); }
  };

  const cardUrl = (f: "og" | "square" | "story", download = false) => active ? `/api/share/${active.code}/card?format=${f}${download ? "&download=1" : ""}&v=${active.id.slice(0, 6)}` : "";

  const shareNative = async (withImage: boolean) => {
    if (!active) return;
    try {
      if (withImage) {
        const blob = await fetch(cardUrl("story")).then((r) => r.blob());
        const file = new File([blob], "convite-orvok.png", { type: "image/png" });
        if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], text, url }); return; }
        const a = document.createElement("a");
        a.href = cardUrl("story", true); a.click();
        await copy(url, "Link");
        toast("Cartão salvo. No Instagram, publique nos Stories e cole o link no adesivo de link.");
        return;
      }
      if (navigator.share) await navigator.share({ title: `Quanto você conhece ${first}?`, text, url });
      else await copy(`${text}`, "Convite");
    } catch { /* user closed the share sheet */ }
  };

  const enc = encodeURIComponent;
  const channels = active ? [
    { id: "whatsapp", name: "WhatsApp", href: `https://wa.me/?text=${enc(text)}`, color: "#25d366" },
    { id: "instagram", name: "Instagram Stories", action: () => void shareNative(true), color: "#e1306c" },
    { id: "facebook", name: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`, color: "#1877f2" },
    { id: "telegram", name: "Telegram", href: `https://t.me/share/url?url=${enc(url)}&text=${enc(text.replace(url, "").trim())}`, color: "#2aabee" },
    { id: "x", name: "X", href: `https://twitter.com/intent/tweet?text=${enc(text.replace(url, "").trim())}&url=${enc(url)}`, color: "#e8edf3" },
    { id: "linkedin", name: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`, color: "#0a66c2" },
    { id: "email", name: "E-mail", href: `mailto:?subject=${enc(`Quanto você conhece ${first}?`)}&body=${enc(text)}`, color: "#a9b3ff" },
  ] : [];

  const t = THEMES.find((x) => x.id === theme)!;

  return (
    <section className="card share-studio" data-p="people" aria-labelledby="studio-title">
      <div className="row-between" style={{ alignItems: "flex-start" }}>
        <div>
          <h2 id="studio-title">Convide quem ainda não está no ORVOK</h2>
          <p className="muted" style={{ marginTop: 6, maxWidth: "60ch" }}>Monte um cartão, escolha o tom e envie por onde a pessoa estiver. Quem abrir o link cria a conta e o pedido chega aqui para você aceitar e consentir.</p>
        </div>
        {active && <span className="tag" data-p="people">{active.uses} de {active.maxUses} usos · expira {relativeTime(active.expiresAt)}</span>}
      </div>

      <div className="studio-grid">
        {/* Live card preview (HTML twin of the PNG) */}
        <div className="studio-preview">
          <div className="studio-format row" role="tablist" aria-label="Formato da prévia">
            <button role="tab" aria-selected={format === "og"} className={format === "og" ? "button button-small" : "button button-small button-secondary"} onClick={() => setFormat("og")}>Link (feed e conversas)</button>
            <button role="tab" aria-selected={format === "story"} className={format === "story" ? "button button-small" : "button button-small button-secondary"} onClick={() => setFormat("story")}>Stories</button>
          </div>
          <div className={`invite-card-frame invite-card-frame-${format}`}>
          <div className={`invite-card invite-card-${format}`} style={{ ["--c-bg" as string]: t.bg, ["--c-ink" as string]: t.ink, ["--c-soft" as string]: t.soft, ["--c-accent" as string]: t.accent, ["--c-accent2" as string]: t.accent2, ["--c-line" as string]: t.line }}
            aria-label="Prévia do cartão de convite">
            <div className="invite-card-rings" aria-hidden="true"><i /><i /><i /><i /><b /><em /><em /><em /></div>
            <div className="invite-card-brand"><span /><span />ORVOK</div>
            <div className="invite-card-copy">
              <small>{profile?.displayName ?? "Você"} te convidou</small>
              <strong>Quanto você conhece {first}?</strong>
              {(teaserText || questions.find((q) => q.questionVersionId === teaser)?.text) && (
                <blockquote><small>Uma das perguntas</small>{questions.find((q) => q.questionVersionId === teaser)?.text ?? teaserText}</blockquote>
              )}
            </div>
            <div className="invite-card-cta"><span>Aceitar o desafio</span><small>{origin.replace(/^https?:\/\//, "")}</small></div>
          </div>
          </div>
        </div>

        {/* Controls */}
        <div className="stack">
          <fieldset className="studio-field">
            <legend className="eyebrow">Estilo</legend>
            <div className="row" style={{ flexWrap: "wrap" }}>
              {THEMES.map((x) => (
                <button key={x.id} type="button" className="swatch" aria-pressed={theme === x.id} onClick={() => setTheme(x.id)}>
                  <span style={{ background: `linear-gradient(135deg, ${x.bg} 55%, ${x.accent} 55% 75%, ${x.accent2} 75%)` }} />{x.name}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="field">
            <span>Pergunta de isca (opcional)</span>
            <select value={teaser} onChange={(e) => setTeaser(e.target.value)}>
              <option value="">Sem pergunta no cartão</option>
              {questions.map((q) => <option key={q.questionVersionId} value={q.questionVersionId}>{q.text}</option>)}
            </select>
            <span className="field-hint">Só o texto da pergunta aparece. A sua resposta nunca vai no cartão.</span>
          </label>
          {!active || dirty ? (
            <div className="form-actions">
              <button className="button" data-p="people" disabled={creating} onClick={() => void create()}>
                {creating ? "Gerando…" : active ? "Atualizar cartão" : "Gerar meu convite"}
              </button>
              {answered === 0 && <span className="field-hint">Dica: responda seu gabarito antes. Quem aceitar só consegue prever depois disso.</span>}
            </div>
          ) : (
            <>
              <fieldset className="studio-field">
                <legend className="eyebrow">Tom da mensagem</legend>
                <div className="row" role="radiogroup" aria-label="Tom">
                  {TONES.map((x) => <button key={x.id} type="button" role="radio" aria-checked={tone === x.id} className={tone === x.id ? "button button-small" : "button button-small button-secondary"} data-p={tone === x.id ? "people" : undefined} onClick={() => setTone(x.id)}>{x.name}</button>)}
                </div>
                <p className="studio-message">{text}</p>
              </fieldset>
              <div className="channels" aria-label="Enviar por">
                {channels.map((c) => c.href ? (
                  <a key={c.id} className="channel lit" href={c.href} target="_blank" rel="noopener noreferrer" style={{ ["--ch" as string]: c.color }}>
                    <ChannelIcon id={c.id} />{c.name}
                  </a>
                ) : (
                  <button key={c.id} type="button" className="channel lit" onClick={c.action} style={{ ["--ch" as string]: c.color }}>
                    <ChannelIcon id={c.id} />{c.name}
                  </button>
                ))}
              </div>
              <div className="studio-link">
                <input className="input" readOnly value={url} aria-label="Link do convite" onFocus={(e) => e.currentTarget.select()} />
                <button className="button button-small button-secondary" onClick={() => void copy(url, "Link")}>Copiar link</button>
                <button className="button button-small button-secondary" onClick={() => void copy(text, "Mensagem")}>Copiar mensagem</button>
              </div>
              <div className="row" style={{ flexWrap: "wrap" }}>
                <a className="text-link" href={cardUrl("story", true)}>Baixar cartão para Stories</a>
                <a className="text-link" href={cardUrl("square", true)}>Baixar cartão quadrado</a>
                <button className="text-link" onClick={() => void shareNative(false)}>Mais opções do celular</button>
              </div>
              {qr && (
                <details className="studio-qr">
                  <summary>Mostrar QR code para quem está perto</summary>
                  <div dangerouslySetInnerHTML={{ __html: qr }} />
                </details>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function ChannelIcon({ id }: { id: string }) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", "aria-hidden": true } as const;
  switch (id) {
    case "whatsapp": return <svg {...common} fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3a.4.4 0 0 0 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4 5.2 5.2 0 0 0 3.1.6 2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.4-.3Z" /></svg>;
    case "instagram": return <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" /></svg>;
    case "facebook": return <svg {...common} fill="currentColor"><path d="M13.5 22v-8h2.7l.4-3.2h-3.1V8.8c0-.9.3-1.5 1.6-1.5h1.6V4.4a22 22 0 0 0-2.4-.1c-2.4 0-4 1.4-4 4.1v2.4H7.6V14h2.7v8h3.2Z" /></svg>;
    case "telegram": return <svg {...common} fill="currentColor"><path d="M21.9 4.6 18.7 19.7c-.2 1-.9 1.3-1.8.8l-4.8-3.6-2.3 2.2c-.3.3-.5.5-1 .5l.3-4.9 9-8.1c.4-.3-.1-.5-.6-.2L6.4 13.4 1.7 12c-1-.3-1-1 .2-1.5L20.5 3.4c.9-.3 1.6.2 1.4 1.2Z" /></svg>;
    case "x": return <svg {...common} fill="currentColor"><path d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.8-6.3L5.4 21H2.3l7.2-8.3L1.9 3h6.3l4.4 5.8L17.8 3Zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5Z" /></svg>;
    case "linkedin": return <svg {...common} fill="currentColor"><path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9.5h4V21H3V9.5Zm7 0h3.8v1.6h.1a4.2 4.2 0 0 1 3.8-2c4 0 4.8 2.7 4.8 6.1V21h-4v-5.1c0-1.2 0-2.8-1.7-2.8s-2 1.3-2 2.7V21h-4V9.5Z" /></svg>;
    default: return <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>;
  }
}
