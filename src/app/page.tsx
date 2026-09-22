import Link from "next/link";
import { SiteHeader } from "../components/SiteHeader";
export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main id="conteudo">
        <section className="container hero" aria-labelledby="hero-title">
          <div>
            <span className="eyebrow">Prever é humano</span>
            <h1 id="hero-title" className="display">
              Pessoas conectam perspectivas.
            </h1>
            <p className="muted">
              No ORVOK, você prevê o mundo, conhece pessoas e descobre novas
              perspectivas sobre si mesmo.
            </p>
            <div className="hero-actions">
              <Link href="/cadastro" className="button">
                Criar conta <span aria-hidden="true">→</span>
              </Link>
              <Link href="#pessoas" className="text-link">
                Conheça o ORVOK
              </Link>
            </div>
          </div>
          <div className="orbit" aria-hidden="true">
            <svg viewBox="0 0 600 600">
              <circle className="orbit-line" cx="300" cy="300" r="240" />
              <circle className="orbit-line" cx="300" cy="300" r="169" />
              <circle className="orbit-line" cx="300" cy="300" r="91" />
              <path
                d="M104 171C229 247 376 349 496 430M119 430C254 357 380 239 495 163"
                stroke="var(--orvok-stone)"
                fill="none"
              />
              <circle className="orbit-node" cx="300" cy="300" r="8" />
              <circle className="orbit-accent" cx="126" cy="133" r="24" />
              <circle className="orbit-node" cx="502" cy="385" r="15" />
              <circle className="orbit-node" cx="178" cy="448" r="13" />
              <circle className="orbit-accent" cx="449" cy="118" r="18" />
              <circle className="orbit-node" cx="377" cy="497" r="5" />
            </svg>
          </div>
        </section>
        <section className="pillar-section" aria-labelledby="pillar-title">
          <div className="container">
            <span className="eyebrow">Pessoas, ideias, o mundo</span>
            <h2 id="pillar-title" className="display">
              Uma forma mais humana de olhar adiante.
            </h2>
            <div className="pillar-grid">
              <article className="pillar" id="mundo">
                <span className="eyebrow">01 / Mundo</span>
                <h3 className="display">Mundo</h3>
                <p>Previsões estruturadas sobre acontecimentos reais.</p>
              </article>
              <article className="pillar" id="pessoas">
                <span className="eyebrow">02 / Pessoas</span>
                <h3 className="display">Pessoas</h3>
                <p>
                  Convites e perspectivas entre pessoas, sempre com
                  consentimento.
                </p>
              </article>
              <article className="pillar" id="voce">
                <span className="eyebrow">03 / Você</span>
                <h3 className="display">Você</h3>
                <p>
                  Um espaço para registrar suas próprias respostas e entender
                  sua trajetória.
                </p>
              </article>
            </div>
          </div>
        </section>
        <section
          id="comunidade"
          className="container pillar-section"
          aria-labelledby="community-title"
        >
          <span className="eyebrow">Comunidade</span>
          <h2 id="community-title" className="display">
            Perspectivas ganham sentido quando se encontram.
          </h2>
        </section>
      </main>
      <footer className="container site-footer" id="sobre">
        <span className="eyebrow">Um olhar mais humano para o futuro</span>
        <span className="muted">ORVOK Social</span>
      </footer>
    </>
  );
}
