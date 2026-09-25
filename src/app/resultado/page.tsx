import { AppShell } from "../../components/app/AppShell";
import { Encounter } from "../../components/app/Encounter";
export const metadata = { title: "O encontro" };
export default function ResultPage() { return <AppShell title="O encontro"><Encounter /></AppShell>; }
