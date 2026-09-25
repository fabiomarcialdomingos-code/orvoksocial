import { AppShell } from "../../components/app/AppShell";
import { CommandCenter } from "../../components/CommandCenter";
export const metadata = { title: "Quartel general" };
export default function AdminPage() {
  return <AppShell title="Quartel general"><CommandCenter /><p><a className="button button-secondary" href="/admin/catalogo">Abrir pré-cadastros</a></p></AppShell>;
}
