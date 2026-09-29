import { AppShell } from "../../components/app/AppShell";
import { DataRightsPanel } from "../../components/DataRightsPanel";
export const metadata = { title: "Privacidade e dados" };
export default function DataPage() {
  return (
    <AppShell title="Privacidade e dados" largo>
      <div className="page-head"><div><h1 className="display">Seus dados, suas escolhas.</h1><p>Exporte tudo o que existe sobre você ou solicite a exclusão.</p></div></div>
      <div className="grid-main"><section className="card"><DataRightsPanel /></section>
        <aside className="card"><h3>Seus convites</h3><p className="muted" style={{ marginTop: 8 }}>Cada desafio que você enviou pode ser cancelado em Desafios. Ao cancelar, o link para de funcionar na hora.</p><a className="text-link" href="/desafios" style={{ marginTop: 12 }}>Abrir desafios</a></aside>
      </div>
    </AppShell>
  );
}
