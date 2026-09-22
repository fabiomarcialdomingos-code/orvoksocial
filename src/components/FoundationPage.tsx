import type { ReactNode } from "react";
import { SiteHeader } from "./SiteHeader";

export function FoundationPage({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main id="conteudo" className="container auth-main">
        <div className="auth-intro">
          <span className="eyebrow">{eyebrow}</span>
          <h1 className="display">{title}</h1>
          <p className="muted">{description}</p>
        </div>
        <div className="auth-card">{children}</div>
      </main>
    </>
  );
}
