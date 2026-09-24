import type { ReactNode } from "react";
import Link from "next/link";
import { OrvokOrbitMap, OrvokPillIcon } from "./OrvokVisualSystem";

type Tone = "gold" | "blue" | "sage" | "violet" | "coral" | "mist";
type MapVariant = "radar" | "invite" | "prediction" | "result";

export function PerspectiveMap({
  variant,
  label,
}: {
  variant: MapVariant;
  label: string;
}) {
  return <OrvokOrbitMap variant={variant} label={label} />;
}

export function AppContextBar({
  section,
  detail,
  progress,
  consent = true,
}: {
  section: string;
  detail?: string;
  progress?: string;
  consent?: boolean;
}) {
  return (
    <div className="radar-app-context orvok-rebuild">
      <div className="radar-app-context-inner">
        <div className="context-label">
          <span>RADAR HUMANO</span>
          {section && (
            <>
              <i aria-hidden="true" />
              <strong>{section}</strong>
            </>
          )}
          {detail && detail !== section && (
            <>
              <i aria-hidden="true" />
              <strong>{detail}</strong>
            </>
          )}
          {progress && (
            <>
              <i aria-hidden="true" />
              <strong>{progress}</strong>
            </>
          )}
        </div>
        {consent && (
          <div className="context-consent">
            <span className="consent-dot" aria-hidden="true" /> Consentimento
            ativo
          </div>
        )}
        <span className="context-tagline">MAIS PERSPECTIVAS. MAIS VOCÊ.</span>
      </div>
    </div>
  );
}

type JourneyStep = {
  number: string;
  title: string;
  description: string;
  href: string;
};
const journeySteps: JourneyStep[] = [
  {
    number: "01",
    title: "Responda sobre você",
    description: "Responda às 12 perguntas para criar seu gabarito pessoal.",
    href: "/onboarding",
  },
  {
    number: "02",
    title: "Convide alguém",
    description: "Envie o convite para uma pessoa de confiança.",
    href: "/convites",
  },
  {
    number: "03",
    title: "Receba uma previsão",
    description: "A outra pessoa aceita, consente e antecipa suas respostas.",
    href: "/previsao",
  },
  {
    number: "04",
    title: "Veja o encontro",
    description: "Compare as perspectivas quando houver evidência suficiente.",
    href: "/resultado",
  },
];

export function RadarJourneyRail({
  activeStep = 2,
  showActions = true,
  children,
}: {
  activeStep?: number;
  showActions?: boolean;
  children?: ReactNode;
}) {
  return (
    <section
      className="radar-journey-rail orvok-rebuild"
      aria-labelledby="journey-rail-title"
    >
      <div className="journey-rail-heading">
        <span id="journey-rail-title" className="eyebrow">
          Como o Radar funciona
        </span>
        <span>QUATRO PASSOS PARA TRANSFORMAR PERSPECTIVAS EM CLAREZA.</span>
      </div>
      <div className="journey-rail-grid">
        {journeySteps.map((step, index) => {
          const stepNumber = index + 1;
          const state =
            stepNumber < activeStep
              ? "complete"
              : stepNumber === activeStep
                ? "active"
                : "locked";
          return (
            <Link
              className={`journey-rail-step journey-rail-${state}`}
              href={step.href}
              key={step.number}
            >
              <span className="journey-rail-marker">
                {state === "complete" ? "✓" : step.number}
              </span>
              <span className="journey-rail-copy">
                <strong>{step.title}</strong>
                <small>{step.description}</small>
              </span>
            </Link>
          );
        })}
      </div>
      {(showActions || children) && (
        <div className="journey-rail-actions">
          {children ?? (
            <>
              <Link href="/convites" className="button button-gold">
                Convidar pessoa <span aria-hidden="true">→</span>
              </Link>
              <span className="journey-rail-note">
                <span aria-hidden="true">♧</span> Cada perspectiva só existe com
                aceite e consentimento ativos.
              </span>
            </>
          )}
        </div>
      )}
    </section>
  );
}

export function StatusPill({
  tone = "sage",
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  return (
    <span className={`visual-status visual-status-${tone}`}>
      <span aria-hidden="true">✓</span>
      {children}
    </span>
  );
}

export function ProgressDots({
  complete = 4,
  total = 12,
}: {
  complete?: number;
  total?: number;
}) {
  return (
    <div
      className="progress-dots"
      aria-label={`${complete} de ${total} respostas previstas`}
    >
      {Array.from({ length: total }, (_, index) => (
        <i key={index} className={index < complete ? "is-complete" : ""} />
      ))}
    </div>
  );
}

export function InsightCard({
  tone,
  eyebrow,
  title,
  value,
  description,
  icon,
}: {
  tone: Tone;
  eyebrow: string;
  title: string;
  value?: string;
  description: string;
  icon: ReactNode;
}) {
  return (
    <article className={`insight-card insight-card-${tone}`}>
      <OrvokPillIcon tone={tone}>{icon}</OrvokPillIcon>
      <div className="insight-copy">
        <span className="eyebrow">{eyebrow}</span>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      {value && (
        <div className="insight-value">
          <strong>{value}</strong>
          <span>de alinhamento</span>
        </div>
      )}
      <span className="insight-arrow" aria-hidden="true">
        →
      </span>
    </article>
  );
}
