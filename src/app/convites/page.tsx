import { FoundationPage } from "../../components/FoundationPage";
import { RadarFlow } from "../../components/RadarFlow";
export default function InvitationsPage() {
  return (
    <FoundationPage
      eyebrow="Radar Humano"
      title="Um convite abre a conversa."
      description="O aceite e o consentimento são decisões separadas. Nenhuma previsão é permitida antes do consentimento ativo."
    >
      <RadarFlow mode="invite" />
    </FoundationPage>
  );
}
