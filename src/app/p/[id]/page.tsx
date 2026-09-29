import {AppShell} from "../../../components/app/AppShell";
import {PublicProfile} from "../../../components/perspectives/Profile";
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <AppShell title="Perfil"><PublicProfile id={id}/></AppShell>;}
