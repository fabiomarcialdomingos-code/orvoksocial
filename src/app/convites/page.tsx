import { FoundationPage } from "../../components/FoundationPage";
import { RadarFlow } from "../../components/RadarFlow";

export default function InvitationsPage() {
  return (
    <FoundationPage
      eyebrow="Radar Humano · 02 de 04"
      title="Agora, escolha quem pode enxergar suas perspectivas."
      description="Convide pessoas de confiança para antecipar suas respostas. O convite, o aceite e o consentimento acontecem em etapas separadas."
      activeStep={2}
    >
      <RadarFlow mode="invite" />
    </FoundationPage>
  );
}
