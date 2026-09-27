import {AppShell} from "../../../components/app/AppShell";
import {ConnectionDetail} from "../../../components/perspectives/Connections";
export default async function Page({params}:{params:Promise<{code:string}>}){const {code}=await params;return <AppShell title="Sua conexão"><ConnectionDetail code={code}/></AppShell>;}
