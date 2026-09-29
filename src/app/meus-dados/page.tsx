import { AppShell } from "../../components/app/AppShell";
import { DataRightsPanel } from "../../components/DataRightsPanel";
export const metadata = { title: "Privacidade e dados" };
export default function DataPage() {
  return (
    <AppShell title="Privacidade e dados">
      <div className="page-head"><div><h1 className="display">Seus dados, suas escolhas.</h1><p>Exporte tudo o que existe sobre você ou solicite a exclusão. Encerre conexões para ocultar comparações compartilhadas.</p></div></div>
      <div className="grid-main"><section className="card"><DataRightsPanel /></section>
        <aside className="card"><h3>Onde revogar</h3><p className="muted" style={{ marginTop: 8 }}>Abra uma conexão e escolha Encerrar conexão. Os resultados e a conversa ficam ocultos para os dois participantes. Para consentimentos antigos, use os Pedidos no Histórico anterior.</p><a className="text-link" href="/conexoes" style={{ marginTop: 12 }}>Abrir conexões</a></aside>
      </div>
    </AppShell>
  );
}
