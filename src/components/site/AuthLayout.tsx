import type { ReactNode } from "react";
import { SiteNav } from "./SiteNav";
export { AuthSwitch } from "./AuthSwitch";
export function AuthLayout({
  title,
  text,
  children,
  footer,
}: {
  title: string;
  text: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <>
      <SiteNav />
      <main id="conteudo" className="auth-layout">
        <section className="auth-aside">
          <span className="eyebrow">Uma pessoa. Muitas perspectivas.</span>
          <h1>{title}</h1>
          <p>{text}</p>
          <div className="auth-art" aria-hidden="true">
            <span>seu olhar</span>
            <b>↔</b>
            <span>outro olhar</span>
          </div>
        </section>
        <section className="auth-panel">
          {children}
          {footer && <p className="auth-switch">{footer}</p>}
        </section>
      </main>
    </>
  );
}
