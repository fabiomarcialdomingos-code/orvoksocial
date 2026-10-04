import { AppShell } from "../../components/app/AppShell";
import { MinhasConexoes } from "../../components/rede/MinhasConexoes";
export const metadata = { title: "Minhas conexões" };
export default function ConexoesPage() { return <AppShell title="Minhas conexões"><MinhasConexoes /></AppShell>; }
