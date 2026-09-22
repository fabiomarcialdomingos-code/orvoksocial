import { FoundationPage } from "../../components/FoundationPage";
import { RadarFlow } from "../../components/RadarFlow";
export default async function AcceptInvitationPage({ searchParams }: { searchParams: Promise<{ convite?: string }> }) {
  const { convite } = await searchParams;
  return (
    <FoundationPage
      eyebrow="Radar Humano"
      title="O convite é seu para decidir."
      description="Aceitar o convite não concede consentimento para ser alvo de previsões."
    >
      <RadarFlow key={convite ?? ""} mode="accept" initialInvitationId={convite ?? ""} />
    </FoundationPage>
  );
}
