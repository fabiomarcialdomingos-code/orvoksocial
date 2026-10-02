import { AppShell } from "../../components/app/AppShell";
import { CommandCenter } from "../../components/CommandCenter";
import { requireAdminPage } from "../../lib/auth/require-admin-page";
export const metadata = { title: "Quartel general" };
export default async function AdminPage() {
  await requireAdminPage();
  return <AppShell title="Quartel general" largo><CommandCenter /><p><a className="button button-secondary" href="/admin/catalogo">Abrir pré-cadastros</a></p></AppShell>;
}
