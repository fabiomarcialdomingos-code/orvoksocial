import { FoundationPage } from "../../components/FoundationPage";
import { RadarFlow } from "../../components/RadarFlow";
export default async function ConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ aceite?: string }>;
}) {
  const { aceite } = await searchParams;
  return (
    <FoundationPage
      eyebrow="Sua escolha"
      title="Você controla sua participação."
      description="Leia o aviso vigente antes de decidir. O registro guarda a versão exata apresentada."
    >
      <RadarFlow key={aceite ?? ""} mode="consent" initialAcceptanceId={aceite ?? ""} />
    </FoundationPage>
  );
}
