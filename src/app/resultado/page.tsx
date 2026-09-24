import Link from "next/link";
import {
  AppContextBar,
  InsightCard,
  PerspectiveMap,
  RadarJourneyRail,
  StatusPill,
} from "../../components/RadarVisuals";
import { SiteHeader } from "../../components/SiteHeader";

export default function ResultPage() {
  return (
    <>
      <SiteHeader variant="app" />
      <AppContextBar section="O encontro" progress="04 de 04" consent={false} />
      <main id="conteudo" className="mockup-page result-page container">
        <section className="result-copy" aria-labelledby="result-title">
          <h1 id="result-title" className="display">
            Onde as perspectivas se encontram.
          </h1>
          <p>
            Compare o que você respondeu com o que as pessoas que conhecem você
            anteciparam.
          </p>
          <StatusPill tone="sage">
            Resultados com evidência suficiente
          </StatusPill>
          <Link
            href="#como-calculamos"
            className="text-link result-method-link"
          >
            Entenda como calculamos <span aria-hidden="true">→</span>
          </Link>
          <div id="como-calculamos" className="result-callout">
            <span className="eyebrow">
              Diferentes olhares.
              <br />
              Uma versão mais completa.
            </span>
            <p>
              Quando perspectivas se encontram, você se enxerga com mais
              clareza.
            </p>
            <i aria-hidden="true" />
          </div>
        </section>
        <section
          className="result-visual"
          aria-label="Mapa de perspectivas que se encontram"
        >
          <PerspectiveMap
            variant="result"
            label="Mapa de Ana, Marcos e Júlia conectados à sua perspectiva"
          />
        </section>
        <aside
          className="result-side"
          aria-label="Principais insights do Radar"
        >
          <div
            className="result-tabs"
            role="tablist"
            aria-label="Visualização dos resultados"
          >
            <button type="button" role="tab" aria-selected="true">
              Visão geral
            </button>
            <button type="button" role="tab" aria-selected="false">
              Por pessoa
            </button>
            <button type="button" role="tab" aria-selected="false">
              Ao longo do tempo
            </button>
          </div>
          <span className="eyebrow result-insights-heading">
            Nossos principais insights
          </span>
          <div className="insight-list">
            <InsightCard
              tone="gold"
              eyebrow="Maior proximidade"
              title="Marcos"
              value="78%"
              description="Suas respostas e as percepções de Marcos mais se aproximam neste Radar."
              icon="♧"
            />
            <InsightCard
              tone="blue"
              eyebrow="Ponto de divergência"
              title="Decisões sob pressão"
              description="Você tende a buscar mais tempo para decidir, enquanto outras pessoas te veem mais rápido e intuitivo nessas situações."
              icon="⌁"
            />
            <InsightCard
              tone="sage"
              eyebrow="Padrão emergente"
              title="Você busca tempo antes de escolher"
              description="As pessoas que te conhecem percebem que você valoriza reflexão, o que se confirma nas suas respostas."
              icon="♧"
            />
          </div>
          <p className="result-private-note">
            <span aria-hidden="true">♙</span> Estes resultados são privados e só
            podem ser compartilhados com consentimento.
          </p>
        </aside>
      </main>
      <RadarJourneyRail activeStep={4}>
        <Link href="/radar" className="button button-gold">
          Explorar outro Radar <span aria-hidden="true">→</span>
        </Link>
        <span className="journey-rail-note">
          NOVAS PERSPECTIVAS TE ESPERAM.
        </span>
      </RadarJourneyRail>
    </>
  );
}
