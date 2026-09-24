import { FoundationPage } from "../../components/FoundationPage";

export default function ResultPage() {
  return (
    <FoundationPage
      eyebrow="Radar Humano · 04 de 04"
      title="Onde as perspectivas se encontram."
      description="Compare o que você respondeu com o que as pessoas que conhecem você anteciparam."
      activeStep={4}
    >
      <section className="journey-empty journey-result" aria-labelledby="result-status">
        <span className="eyebrow">O encontro</span>
        <h2 id="result-status" className="display">Resultados com evidência suficiente.</h2>
        <p className="muted">Abra um evento resolvido ou um snapshot autorizado para consultar os insights da sua perspectiva.</p>
        <a className="button" href="/radar">Explorar meu Radar <span aria-hidden="true">→</span></a>
      </section>
    </FoundationPage>
  );
}
