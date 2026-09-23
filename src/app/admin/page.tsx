import { SiteHeader } from "../../components/SiteHeader";
import { CommandCenter } from "../../components/CommandCenter";
import { CatalogStatusPanel } from "../../components/CatalogStatusPanel";
export default function AdminPage() { return <><SiteHeader /><div className="container social-main"><CatalogStatusPanel /><p><a className="button button-secondary" href="/admin/catalogo">Abrir pré-cadastros</a></p></div><CommandCenter /></>; }
