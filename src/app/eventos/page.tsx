import { AppShell } from "../../components/app/AppShell";
import { MundoPessoas } from "../../components/rede/MundoPessoas";
export const metadata = { title: "Mundo" };
export default function EventsPage() { return <AppShell title="Mundo"><MundoPessoas /></AppShell>; }
