import Link from "next/link";
import { BrandMark } from "../ui/Brand";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container site-footer-inner">
        <span className="row"><BrandMark size={20} /> ORVOK · perspectivas com consentimento</span>
        <nav aria-label="Rodapé">
          <Link prefetch={false} href="/comecar">Como funciona</Link>
          <Link href="/privacidade">Privacidade</Link>
          <Link href="/termos">Termos de uso</Link>
          <Link href="/meus-dados">Meus dados</Link>
          <Link href="/entrar">Entrar</Link>
        </nav>
      </div>
    </footer>
  );
}
