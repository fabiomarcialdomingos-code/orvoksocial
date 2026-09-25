import { AppShell } from "../../components/app/AppShell";
import { Feed } from "../../components/app/Community";
export const metadata = { title: "Feed" };
export default function FeedPage() { return <AppShell title="Feed"><Feed /></AppShell>; }
