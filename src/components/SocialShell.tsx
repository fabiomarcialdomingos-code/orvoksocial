"use client";

import Link from "next/link";
import { type ReactNode, useState } from "react";

type Section = "perfil" | "grupos" | "feed" | "notificacoes" | "admin";

const nav: Array<{ id: Section; label: string; href: string }> = [
  { id: "perfil", label: "Perfil", href: "/perfil" },
  { id: "grupos", label: "Grupos", href: "/grupos" },
  { id: "feed", label: "Feed", href: "/feed" },
  { id: "notificacoes", label: "Notificações", href: "/notificacoes" },
];

export function SocialShell({ section = "perfil", mathPanel }: { section?: Section; mathPanel?: ReactNode }) {
  const [notice, setNotice] = useState<string | null>(null);
  const [reaction, setReaction] = useState(false);
  const title = section === "perfil" ? "Seu espaço de perspectivas" : nav.find((item) => item.id === section)?.label ?? "Administração";

  return (
    <main id="conteudo" className="social-main container">
      <div className="social-heading">
        <div><span className="eyebrow">ORVOK Social · TEST_ONLY</span><h1 className="display">{title}</h1><p className="muted">Ambiente de homologação. Estados estruturais sem score ou reputação matemática.</p></div>
        <Link href="/radar" className="button button-secondary">Abrir Radar</Link>
      </div>
      <div className="social-layout">
        <aside className="social-sidebar" aria-label="Navegação social">
          <div className="social-avatar" aria-hidden="true">FA</div><strong>Fabio Almeida</strong><span className="muted">Perspectiva em construção</span>
          <nav className="social-nav">{nav.map((item) => <Link key={item.id} href={item.href} aria-current={section === item.id ? "page" : undefined}>{item.label}</Link>)}<Link href="/eventos">Eventos do mundo</Link><Link href="/meus-dados">Privacidade e dados</Link>{section === "admin" && <Link href="/admin" aria-current="page">Administração</Link>}</nav>
        </aside>
        <div className="social-content">
          {section === "perfil" && <>
            <section className="social-card profile-hero"><div className="social-avatar social-avatar-large">FA</div><div><span className="eyebrow">Perfil de teste</span><h2>Fabio Almeida</h2><p className="muted">Curioso sobre como pessoas constroem suas perspectivas.</p></div><button className="button button-secondary" onClick={() => setNotice("Edição de perfil ficará disponível após o contrato de perfil.")}>Editar perfil</button></section>
            <div className="stat-grid"><Stat label="Previsões feitas" value="—" hint="sem score" /><Stat label="Previsões recebidas" value="—" hint="com consentimento" /><Stat label="Matches" value="0" hint="reciprocidade estrutural" /></div>
            <section className="social-card"><SectionTitle eyebrow="Atividade" title="Sua trajetória" /><Empty text="As interações aparecerão aqui quando os fluxos de teste forem concluídos." /><Link href="/radar" className="text-link">Ver atividade do Radar</Link></section>
          </>}
          {section === "grupos" && <><section className="social-card"><SectionTitle eyebrow="Comunidade" title="Grupos de perspectiva" /><p className="muted">Crie espaços privados para explorar perguntas em conjunto. O conteúdo desta área é restrito a membros autorizados.</p><button className="button" onClick={() => setNotice("A criação de grupos será habilitada após a API de grupos ser publicada.")}>Criar grupo</button></section><div className="social-card"><h3>Seus grupos</h3><Empty text="Você ainda não participa de nenhum grupo." /><Link href="/eventos" className="text-link">Ver eventos de teste</Link></div></>}
          {section === "feed" && <><section className="social-card"><SectionTitle eyebrow="Perspectivas" title="Feed autenticado" /><p className="muted">O feed mostra somente conteúdo compartilhado com você e ações auditáveis.</p><div className="feed-item"><div className="social-avatar">MR</div><div><strong>Marina Rocha</strong><span className="muted"> · evento de teste · agora</span><p>Uma previsão só faz sentido quando podemos voltar à evidência.</p><div className="feed-actions"><button className="text-link" aria-pressed={reaction} onClick={() => setReaction(!reaction)}>{reaction ? "Reação registrada" : "Reagir"}</button><button className="text-link" onClick={() => setNotice("Comentários serão gravados pela API e auditados.")}>Comentar</button><button className="text-link" onClick={() => setNotice("Denúncias serão encaminhadas à moderação.")}>Denunciar</button></div></div></div></section></>}
          {section === "notificacoes" && <section className="social-card"><SectionTitle eyebrow="Acompanhar" title="Notificações" /><div className="notification-row"><span className="notification-dot" aria-hidden="true" /><div><strong>Convites e consentimentos</strong><p className="muted">As notificações operacionais do Radar estão disponíveis no painel.</p></div><Link href="/radar#notificacoes" className="text-link">Abrir</Link></div><Empty text="Nenhuma notificação social nova." /></section>}
          {section === "admin" && <AdminPanel onNotice={setNotice} />}
          {section === "perfil" && mathPanel}
          {notice && <p className="form-message" role="status">{notice}</p>}
        </div>
      </div>
    </main>
  );
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) { return <header className="social-section-title"><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></header>; }
function Empty({ text }: { text: string }) { return <div className="social-empty" role="status"><span aria-hidden="true">○</span><p>{text}</p></div>; }
function Stat({ label, value, hint }: { label: string; value: string; hint: string }) { return <div className="social-card stat"><span className="eyebrow">{label}</span><strong>{value}</strong><span className="muted">{hint}</span></div>; }
function AdminPanel({ onNotice }: { onNotice: (value: string) => void }) { return <><section className="social-card"><SectionTitle eyebrow="Acesso restrito" title="Admin Command Center" /><p className="muted">Ações administrativas exigem permissão, motivo e auditoria. Esta interface não expõe dados fora da autorização.</p><div className="admin-grid">{["Usuários", "Moderação", "Denúncias", "Eventos", "Grupos", "Auditoria"].map((item) => <button key={item} className="admin-tile" onClick={() => onNotice(`${item}: consulta disponível após autorização administrativa.`)}><strong>{item}</strong><span className="muted">Abrir módulo →</span></button>)}</div></section><section className="social-card"><h3>Métricas operacionais</h3><div className="stat-grid"><Stat label="Eventos ativos" value="0" hint="estrutural" /><Stat label="Pendências" value="—" hint="sem dados" /></div></section></>; }
