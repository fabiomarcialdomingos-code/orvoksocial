import { FoundationPage } from "../../components/FoundationPage";

export default function PredictionPage() {
  return (
    <FoundationPage
      eyebrow="Radar Humano · 03 de 04"
      title="O olhar do outro está chegando."
      description="A pessoa convidada aceita, consente e antecipa suas respostas. A previsão será comparada ao seu gabarito quando houver evidência suficiente."
      activeStep={3}
    >
      <section className="journey-empty" aria-labelledby="prediction-status">
        <span className="eyebrow">Em análise</span>
        <h2 id="prediction-status" className="display">Aguardando uma previsão válida.</h2>
        <p className="muted">Mais respostas tornam o encontro mais preciso. Você poderá acompanhar o andamento aqui.</p>
        <a className="button" href="/convites">Ver convites <span aria-hidden="true">→</span></a>
      </section>
    </FoundationPage>
  );
}
