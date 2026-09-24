import type { ReactNode } from "react";
import { SiteHeader } from "./SiteHeader";

const journey = [
  ["01", "Responda sobre você"],
  ["02", "Convide alguém"],
  ["03", "Receba uma previsão"],
  ["04", "Veja o encontro"],
] as const;

export function FoundationPage({
  eyebrow,
  title,
  description,
  children,
  activeStep,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  activeStep?: number;
}) {
  return (
    <>
      <SiteHeader />
      <main id="conteudo" className="container foundation-main">
        <div className="foundation-intro">
          <span className="eyebrow">{eyebrow}</span>
          <h1 className="display">{title}</h1>
          <p className="muted">{description}</p>
          <div className="foundation-orbit" aria-hidden="true">
            <span className="foundation-orbit-center">ORVOK</span>
            <i className="foundation-orbit-node foundation-orbit-node-a" />
            <i className="foundation-orbit-node foundation-orbit-node-b" />
            <i className="foundation-orbit-node foundation-orbit-node-c" />
          </div>
        </div>
        <div className="foundation-content">
          <div className="foundation-journey" aria-label="Etapas do Radar Humano">
            {journey.map(([number, label], index) => (
              <div className={`foundation-journey-step ${activeStep === index + 1 ? "is-active" : ""} ${activeStep && index + 1 < activeStep ? "is-complete" : ""}`} key={number}>
                <span>{number}</span>
                <strong>{label}</strong>
              </div>
            ))}
          </div>
          <div className="auth-card">{children}</div>
        </div>
      </main>
    </>
  );
}
