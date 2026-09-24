import Link from "next/link";
import {
  AppContextBar,
  PerspectiveMap,
  RadarJourneyRail,
} from "../../components/RadarVisuals";
import { RadarWorkspace } from "../../components/RadarWorkspace";
import { SiteHeader } from "../../components/SiteHeader";

export default function RadarPage() {
  return (
    <>
      <SiteHeader variant="app" />
      <AppContextBar section="3 perspectivas conectadas" consent />
      <main id="conteudo" className="mockup-page radar-page-v2">
        <section
          className="radar-v2-hero container"
          aria-labelledby="radar-title"
        >
          <div className="radar-v2-copy">
            <span className="eyebrow">Uma cartografia do olhar</span>
            <h1 id="radar-title" className="display">
              Pensamentos diferentes.
              <br />
              Uma perspectiva compartilhada.
            </h1>
            <p>
              O Radar revela onde as pessoas que conhecem você se aproximam e
              antecipam suas escolhas.
            </p>
            <div className="radar-v2-actions">
              <Link href="#responder" className="button button-outline">
                Explorar meu Radar <span aria-hidden="true">→</span>
              </Link>
              <Link href="#como-funciona" className="text-link">
                Como funciona <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
          <section className="radar-v2-map" aria-label="Mapa do Radar Humano">
            <PerspectiveMap
              variant="radar"
              label="Sua perspectiva conectada a Ana, Marcos, Júlia e padrões emergentes"
            />
            <p className="radar-v2-motto">
              PERSPECTIVAS
              <br />
              HOJE.
              <br />
              HORIZONTES
              <br />
              AMANHÃ.
            </p>
          </section>
          <aside className="radar-v2-legend" aria-label="Legenda do Radar">
            <button type="button" className="legend-select">
              Visão geral <span aria-hidden="true">⌄</span>
            </button>
            <button type="button" className="legend-reading">
              <span aria-hidden="true">⌁</span> Em leitura
            </button>
            <div className="legend-list">
              <span>
                <i className="legend-dot legend-dot-gold" /> Sua perspectiva
              </span>
              <span>
                <i className="legend-dot legend-dot-blue" /> Perspectivas
                convidadas
              </span>
              <span>
                <i className="legend-line" /> Conexão em análise
              </span>
              <span>
                <i className="legend-ring" /> Campo de insights
              </span>
            </div>
          </aside>
        </section>
        <RadarJourneyRail activeStep={2} />
        <section
          className="radar-next-strip container"
          aria-label="Próximos movimentos"
        >
          <article>
            <span className="eyebrow">Maior proximidade</span>
            <strong>Marcos</strong>
            <p>Aguarde mais respostas para confirmar.</p>
            <span aria-hidden="true">→</span>
          </article>
          <article>
            <span className="eyebrow">Ponto de divergência</span>
            <strong>Em construção</strong>
            <p>Mais perspectivas trarão clareza sobre este ponto.</p>
            <span aria-hidden="true">→</span>
          </article>
          <article>
            <span className="eyebrow">Próximo movimento</span>
            <strong>Convide uma nova perspectiva</strong>
            <p>Quanto mais pessoas, mais completo seu Radar.</p>
            <span aria-hidden="true">→</span>
          </article>
          <aside>
            <span aria-hidden="true">♙</span>
            <p>
              Cada conexão só existe
              <br />
              com aceite e consentimento ativos.
            </p>
          </aside>
        </section>
        <section
          className="radar-operational-zone container"
          aria-labelledby="operational-title"
        >
          <div className="operational-heading">
            <span className="eyebrow">Área operacional</span>
            <h2 id="operational-title" className="display">
              Continue seu Radar
            </h2>
            <p>
              Os controles de respostas, convites, previsões, notificações e
              dados continuam disponíveis abaixo da composição visual.
            </p>
          </div>
          <RadarWorkspace />
        </section>
      </main>
    </>
  );
}
