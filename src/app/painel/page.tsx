import { AppShell } from "../../components/app/AppShell";
import { Dashboard } from "../../components/app/Home";
export const metadata = { title: "Início" };
export default function PainelPage() { return <AppShell title="Início"><Dashboard /></AppShell>; }
