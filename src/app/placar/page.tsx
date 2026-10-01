import { AppShell } from "../../components/app/AppShell";
import { MeuPlacar } from "../../components/rede/MeuPlacar";
export const metadata = { title: "Meu placar" };
export default function PlacarPage() { return <AppShell title="Meu placar"><MeuPlacar /></AppShell>; }
