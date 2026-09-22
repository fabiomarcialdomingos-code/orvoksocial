import Link from "next/link";
import { OrvokLogo } from "./brand/OrvokLogo";
export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link href="/" aria-label="ORVOK — início">
          <OrvokLogo />
        </Link>
        <nav className="site-nav" aria-label="Navegação principal">
          <Link href="/#mundo">Mundo</Link>
          <Link href="/#pessoas">Pessoas</Link>
          <Link href="/#voce">Você</Link>
          <Link href="/#comunidade">Comunidade</Link>
          <Link href="/#sobre">Sobre</Link>
        </nav>
        <div className="header-actions">
          <details className="mobile-menu">
            <summary>Menu</summary>
            <nav aria-label="Navegação móvel">
              <Link href="/#mundo">Mundo</Link>
              <Link href="/#pessoas">Pessoas</Link>
              <Link href="/#voce">Você</Link>
              <Link href="/#comunidade">Comunidade</Link>
              <Link href="/#sobre">Sobre</Link>
              <Link href="/convites">Convites</Link>
              <Link href="/radar">Radar</Link>
              <Link href="/entrar">Entrar</Link>
              <Link href="/cadastro">Criar conta</Link>
            </nav>
          </details>
          <Link href="/radar" className="text-link">Radar</Link>
          <Link href="/entrar" className="text-link">
            Entrar
          </Link>
          <Link href="/cadastro" className="button">
            Criar conta <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
