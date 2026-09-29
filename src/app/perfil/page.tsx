import Link from "next/link";
import { AppShell } from "../../components/app/AppShell";
import { ProfileView } from "../../components/app/Community";
export const metadata = { title: "Perfil" };
export default function ProfilePage() {
  return (
    <AppShell title="Perfil">
      <ProfileView />
      <p style={{ marginTop: 16 }}><Link className="text-link" href="/meus-dados">Privacidade e meus dados</Link></p>
    </AppShell>
  );
}
