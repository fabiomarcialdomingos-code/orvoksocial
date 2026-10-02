import { AppShell } from "../../components/app/AppShell";
import { AtivarAvisos } from "../../components/app/AtivarAvisos";
import { Notifications } from "../../components/app/Community";
export const metadata = { title: "Notificações" };
export default function NotificationsPage() { return <AppShell title="Notificações"><AtivarAvisos /><Notifications /></AppShell>; }
