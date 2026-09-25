import { AppShell } from "../../components/app/AppShell";
import { DataRightsPanel } from "../../components/DataRightsPanel";
export const metadata = { title: "Privacidade e dados" };
export default function DataPage() {
  return (
    <AppShell title="Privacidade e dados">
      <div className="page-head"><div><h1 className="display">Seus dados, suas escolhas.</h1><p>Exporte tudo o que existe sobre você ou solicite a exclusão. Consentimentos dados a outras pessoas podem ser revogados em Pedidos.</p></div></div>
      <div className="grid-main"><section className="card"><DataRightsPanel /></section>
        <aside className="card"><h3>Onde revogar</h3><p className="muted" style={{ marginTop: 8 }}>Cada pessoa autorizada a te prever aparece em Pedidos, com um botão para revogar. Ao revogar, as previsões dela deixam de ser visíveis na hora.</p><a className="text-link" href="/convites" style={{ marginTop: 12 }}>Abrir pedidos</a></aside>
      </div>
    </AppShell>
  );
}
