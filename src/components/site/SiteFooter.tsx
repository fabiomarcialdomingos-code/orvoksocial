import Link from "next/link";
import { BrandMark } from "../ui/Brand";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container site-footer-inner">
        <span className="row"><BrandMark size={20} /> ORVOK · perspectivas com consentimento</span>
        <nav aria-label="Rodapé">
          <Link href="/#como-funciona">Como funciona</Link>
          <Link href="/#consentimento">Privacidade e consentimento</Link>
          <Link href="/entrar">Entrar</Link>
          <Link href="/cadastro">Criar conta</Link>
        </nav>
      </div>
    </footer>
  );
}
