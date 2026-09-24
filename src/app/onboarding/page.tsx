import { FoundationPage } from "../../components/FoundationPage";

export default function OnboardingPage() {
  return (
    <FoundationPage
      eyebrow="Radar Humano · 01 de 04"
      title="Comece pelo seu próprio olhar."
      description="Responda às perguntas para criar seu gabarito pessoal. Não existe resposta certa; existe a sua perspectiva."
      activeStep={1}
    >
      <section className="journey-empty" aria-labelledby="onboarding-status">
        <span className="eyebrow">Seu gabarito</span>
        <h2 id="onboarding-status" className="display">Sua primeira perspectiva começa aqui.</h2>
        <p className="muted">O questionário será aberto em uma conta autorizada. Depois, você poderá convidar pessoas de confiança.</p>
        <a className="button" href="/radar">Responder às perguntas <span aria-hidden="true">→</span></a>
      </section>
    </FoundationPage>
  );
}
