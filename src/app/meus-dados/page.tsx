import Link from "next/link";
import { AppShell } from "../../components/app/AppShell";
import { DataRightsPanel } from "../../components/DataRightsPanel";
import r from "../../components/rede/rede.module.css";
export const metadata = { title: "Privacidade e dados" };
export default function DataPage() {
  return (
    <AppShell title="Privacidade e dados">
      <section className={r.hero}>
        <small className={r.marcador}>Seus dados, suas escolhas</small>
        <h2>Você decide o que fica aqui.</h2>
        <p>Baixe tudo o que existe sobre você ou peça a exclusão. Cada desafio enviado pode ser cancelado a qualquer momento.</p>
        <div className={r.chips}><Link className={r.chip} href="/desafios">Abrir meus desafios</Link></div>
      </section>
      <section className={r.item}><DataRightsPanel /></section>
    </AppShell>
  );
}
