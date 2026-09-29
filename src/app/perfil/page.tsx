import { AppShell } from "../../components/app/AppShell";
import { ProfileView } from "../../components/app/Community";
export const metadata = { title: "Perfil" };
export default function ProfilePage() { return <AppShell title="Perfil"><ProfileView /></AppShell>; }
