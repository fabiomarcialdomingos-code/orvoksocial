import { AppShell } from "../../../../components/app/AppShell";
import { SnapshotView } from "../../../../components/SnapshotView";
export const metadata = { title: "Registro da previsão" };
export default async function SnapshotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AppShell title="Registro da previsão">
      <div className="page-head"><div><h1 className="display">Registro da previsão</h1><p>O registro guarda o que foi enviado e a versão do consentimento válida no momento.</p></div></div>
      <section className="card"><SnapshotView id={id} /></section>
    </AppShell>
  );
}
