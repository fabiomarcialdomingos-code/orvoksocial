import Link from "next/link";
import type { ReactNode } from "react";
import { Globo } from "../desafio/Globo";
import { SiteNav } from "./SiteNav";
import s from "./auth.module.css";

/** Entrar, cadastro e recuperação: globo vivo de um lado, formulário do outro. */
export function AuthLayout({ title, text, children, footer }: { title: string; text: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <>
      <SiteNav />
      <main id="conteudo" className={s.layout}>
        <section className={s.aside} aria-labelledby="auth-title">
          <div className={s.globo} aria-hidden="true">
            <Globo opcoes={{ pontos: 1500, pessoas: 24, arcos: 12, escala: 0.34, velocidade: 0.0025, montagem: 1.4, malha: true }} />
          </div>
          <div className={s.texto}>
            <h1 id="auth-title">{title}</h1>
            <p>{text}</p>
            <Link className={s.atalho} prefetch={false} href="/comecar">Ainda sem conta? Comece sem cadastro, respondendo sobre você.</Link>
          </div>
        </section>
        <section className={s.painel}>
          {children}
          {footer && <p className="auth-switch">{footer}</p>}
        </section>
      </main>
    </>
  );
}

export function AuthSwitch({ question, href, action }: { question: string; href: string; action: string }) {
  return <>{question} <Link className="text-link" href={href}>{action}</Link></>;
}
