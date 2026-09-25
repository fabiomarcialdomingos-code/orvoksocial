import Link from "next/link";
import type { ReactNode } from "react";
import { Instrument } from "../ui/Instrument";
import { SiteNav } from "./SiteNav";

const nodes = [
  { id: "you", p: "self" as const, r: 0, angle: 0, size: 8 },
  { id: "a", p: "people" as const, r: 0.45, angle: -50, linked: true },
  { id: "b", p: "people" as const, r: 0.32, angle: 40, linked: true },
  { id: "c", p: "world" as const, r: 0.88, angle: 140, size: 5 },
  { id: "d", p: "world" as const, r: 0.9, angle: 220, size: 4 },
  { id: "e", p: "people" as const, r: 0.62, angle: 280, size: 4 },
];

export function AuthLayout({ title, text, children, footer }: { title: string; text: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <>
      <SiteNav />
      <main id="conteudo" className="auth-layout">
        <section className="auth-aside" aria-labelledby="auth-title">
          <div className="auth-instrument" aria-hidden="true">
            <Instrument nodes={nodes} label="" interactive={false} />
          </div>
          <h1 id="auth-title" className="display">{title}</h1>
          <p>{text}</p>
        </section>
        <section className="auth-panel">
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
