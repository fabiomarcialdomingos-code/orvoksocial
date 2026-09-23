import { FoundationPage } from "../../components/FoundationPage";

export default function OnboardingPage() {
  return (
    <FoundationPage
      eyebrow="Primeiros passos · TEST_ONLY"
      title="Seu espaço está pronto para começar."
      description="O onboarding visual está disponível para inspeção. A ativação de conta e as etapas de produto permanecem controladas até a homologação."
    >
      <section className="empty-state" aria-labelledby="onboarding-status">
        <h2 id="onboarding-status">Onboarding em preparação</h2>
        <p className="muted">
          Nenhuma pergunta oficial ou dado real é carregado nesta etapa. Continue para o Radar quando estiver usando uma conta de teste autorizada.
        </p>
        <a className="button" href="/radar">Abrir Radar de teste</a>
      </section>
    </FoundationPage>
  );
}
