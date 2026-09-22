import { FoundationPage } from "../../../../components/FoundationPage";
import { SnapshotView } from "../../../../components/SnapshotView";

export default async function SnapshotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FoundationPage eyebrow="Radar Humano · TEST_ONLY" title="Registro da previsão." description="O snapshot preserva o que foi enviado e a versão do consentimento válida no momento da previsão."><SnapshotView id={id} /></FoundationPage>;
}
