import { FoundationPage } from "../../components/FoundationPage";
import { DataRightsPanel } from "../../components/DataRightsPanel";

export default function DataRightsPage() {
  return (
    <FoundationPage
      eyebrow="Privacidade"
      title="Seus dados, suas escolhas."
      description="Exporte seus registros ou solicite exclusão. A política técnica permanece provisória e exige revisão jurídica antes do uso comercial."
    >
      <DataRightsPanel />
    </FoundationPage>
  );
}
