import { AppShell } from "../../components/app/AppShell";
import { RadarVivo } from "../../components/rede/RadarVivo";
export const metadata = { title: "Meu radar" };
export default function RadarPage() { return <AppShell title="Meu radar"><RadarVivo /></AppShell>; }
