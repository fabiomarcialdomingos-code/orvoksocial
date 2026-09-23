import { FoundationPage } from "../../components/FoundationPage";

export default function PredictionPage() {
  return <FoundationPage eyebrow="Previsão · TEST_ONLY" title="Previsão estrutural" description="O ciclo de previsão mundial permanece disponível apenas com eventos e fixtures de teste."><section className="empty-state" aria-labelledby="prediction-status"><h2 id="prediction-status">Escolha uma oportunidade no calendário</h2><p className="muted">Confiança, confirmação e snapshot são preparados em ambiente de teste. Score, Brier e ranking continuam desligados.</p><a className="button" href="/eventos">Abrir eventos</a></section></FoundationPage>;
}
