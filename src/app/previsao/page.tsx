import Link from "next/link";
import {
  AppContextBar,
  PerspectiveMap,
  ProgressDots,
  RadarJourneyRail,
} from "../../components/RadarVisuals";
import { SiteHeader } from "../../components/SiteHeader";

const people = [
  { name: "Ana", status: "Convite enviado", icon: "✉", tone: "blue" },
  { name: "Júlia", status: "Aguardando aceite", icon: "◷", tone: "sage" },
  { name: "Marcos", status: "Previsão em andamento", icon: "◌", tone: "gold" },
];

export default function PredictionPage() {
  return (
    <>
      <SiteHeader variant="app" />
      <AppContextBar section="Previsões" progress="03 de 04" />
      <main id="conteudo" className="mockup-page prediction-page container">
        <section className="prediction-copy" aria-labelledby="prediction-title">
          <span className="eyebrow">O encontro em construção</span>
          <h1 id="prediction-title" className="display">
            O olhar do outro está chegando.
          </h1>
          <p>
            Marcos aceitou o convite e consentiu em antecipar suas respostas. A
            previsão será comparada ao seu gabarito quando houver evidência
            suficiente.
          </p>
          <p className="prediction-motto">
            MAIS
            <br />
            PERSPECTIVAS.
            <br />
            MAIS VOCÊ.
            <span aria-hidden="true" />
          </p>
        </section>
        <section
          className="prediction-visual"
          aria-label="Mapa da previsão em andamento"
        >
          <PerspectiveMap
            variant="prediction"
            label="Sua perspectiva conectada à previsão de Marcos"
          />
        </section>
        <aside className="prediction-side" aria-label="Status da previsão">
          <article className="prediction-status-card">
            <div className="prediction-status-heading">
              <span className="analysis-ring" aria-hidden="true" />
              <div>
                <span className="eyebrow">Previsão</span>
                <h2>Em análise</h2>
              </div>
              <span className="prediction-type">PREVISÃO</span>
            </div>
            <p className="prediction-waiting">
              <span aria-hidden="true">●</span> Aguardando resposta
            </p>
            <div className="prediction-progress">
              <ProgressDots complete={4} total={12} />
              <strong>4 de 12</strong>
            </div>
            <span className="prediction-progress-label">
              respostas previstas
            </span>
            <p className="prediction-card-note">
              Mais respostas tornam o encontro mais preciso.
            </p>
          </article>
          <article className="people-radar-card">
            <span className="eyebrow">Pessoas neste Radar</span>
            {people.map((person) => (
              <div className="people-radar-row" key={person.name}>
                <span
                  className={`people-avatar people-avatar-${person.tone}`}
                  aria-hidden="true"
                >
                  ♙
                </span>
                <strong>{person.name}</strong>
                <span
                  className={`people-state people-state-${person.tone}`}
                  aria-hidden="true"
                >
                  {person.icon}
                </span>
                <span>{person.status}</span>
                <span aria-hidden="true">›</span>
              </div>
            ))}
          </article>
        </aside>
      </main>
      <RadarJourneyRail activeStep={3}>
        <Link href="/convites" className="button button-outline">
          Ver convites <span aria-hidden="true">→</span>
        </Link>
        <span className="journey-rail-note">
          <span aria-hidden="true">ⓘ</span> A pessoa convidada pode interromper
          o processo a qualquer momento.
        </span>
      </RadarJourneyRail>
    </>
  );
}
