import { FoundationPage } from "../../components/FoundationPage";
import { RadarFlow } from "../../components/RadarFlow";
export default function AcceptInvitationPage() {
  return (
    <FoundationPage
      eyebrow="Radar Humano"
      title="O convite é seu para decidir."
      description="Aceitar o convite não concede consentimento para ser alvo de previsões."
    >
      <RadarFlow mode="accept" />
    </FoundationPage>
  );
}
