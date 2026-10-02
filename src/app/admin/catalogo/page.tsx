import { AppShell } from "../../../components/app/AppShell";
import { AdminCatalogManager } from "../../../components/AdminCatalogManager";
import { requireAdminPage } from "../../../lib/auth/require-admin-page";
export const metadata = { title: "Pré-cadastros" };
export default async function AdminCatalogPage() {
  await requireAdminPage();
  return <AppShell title="Pré-cadastros"><AdminCatalogManager /></AppShell>;
}
