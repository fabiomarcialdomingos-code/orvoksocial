import { Suspense } from "react";
import { AppShell } from "../../components/app/AppShell";
import { Requests } from "../../components/app/Requests";
export const metadata = { title: "Pedidos e convites" };
export default function RequestsPage() {
  return <AppShell title="Pedidos e convites"><Suspense><Requests /></Suspense></AppShell>;
}
