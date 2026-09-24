import {
  AppContextBar,
  PerspectiveMap,
  RadarJourneyRail,
} from "../../components/RadarVisuals";
import { RadarFlow } from "../../components/RadarFlow";
import { SiteHeader } from "../../components/SiteHeader";

export default function InvitationsPage() {
  return (
    <>
      <SiteHeader variant="app" />
      <AppContextBar section="Convites" progress="02 de 04" />
      <main id="conteudo" className="mockup-page invite-page container">
        <section className="invite-copy" aria-labelledby="invite-title">
          <span className="eyebrow">Convites que ampliam seu olhar</span>
          <h1 id="invite-title" className="display">
            Agora, escolha quem pode enxergar suas perspectivas.
          </h1>
          <p>
            Convide pessoas de confiança para antecipar suas respostas.
            <br />O convite, o aceite e o consentimento acontecem em etapas
            separadas.
          </p>
          <div className="invite-form-card">
            <RadarFlow mode="invite" />
          </div>
        </section>
        <section
          className="invite-visual"
          aria-labelledby="invite-visual-title"
        >
          <h2 id="invite-visual-title" className="sr-only">
            Conexões disponíveis
          </h2>
          <PerspectiveMap
            variant="invite"
            label="Mapa de convites ao redor da sua perspectiva"
          />
          <p className="invite-visual-note">
            Cada nova perspectiva
            <br />
            ilumina uma parte diferente
            <br />
            do seu Radar.
            <span aria-hidden="true" />
          </p>
          <p className="invite-visual-motto">
            PESSOAS
            <br />
            REAIS.
            <br />
            PERSPECTIVAS
            <br />
            MAIS REAIS.
            <br />
            AINDA.
          </p>
        </section>
      </main>
      <RadarJourneyRail activeStep={2} />
    </>
  );
}
