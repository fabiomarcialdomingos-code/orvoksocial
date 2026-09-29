import Link from "next/link";
import { Brand } from "../ui/Brand";
export function SiteNav() {
  return (
    <header className="landing-nav">
      <Brand />
      <nav aria-label="Navegação">
        <Link href="/#pessoas">Pessoas</Link>
        <Link href="/#mundo">Mundo</Link>
        <Link href="/#como-funciona">Como funciona</Link>
      </nav>
      <div>
        <Link href="/entrar" className="text-link">
          Entrar
        </Link>
        <Link href="/cadastro" className="button button-small">
          Fazer parte ↗
        </Link>
      </div>
    </header>
  );
}
