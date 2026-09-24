import Link from "next/link";
import { SiteHeader } from "../components/SiteHeader";

function PerspectiveOrbit() {
  return (
    <div className="home-orbit" aria-label="Universo de perspectivas ORVOK">
      <svg viewBox="0 0 600 560" role="img" aria-labelledby="orbit-title orbit-desc">
        <title id="orbit-title">Perspectivas conectadas no universo ORVOK</title>
        <desc id="orbit-desc">
          Uma esfera central ORVOK conectada a você, pessoas, mundo, memória e escolhas.
        </desc>
        <ellipse className="home-orbit-line home-orbit-line-blue" cx="300" cy="280" rx="248" ry="184" />
        <ellipse className="home-orbit-line home-orbit-line-gold" cx="300" cy="280" rx="214" ry="138" transform="rotate(24 300 280)" />
        <ellipse className="home-orbit-line home-orbit-line-gold" cx="300" cy="280" rx="205" ry="132" transform="rotate(-28 300 280)" />
        <path className="home-orbit-thread" d="M106 188C215 253 373 321 499 387" />
        <path className="home-orbit-thread" d="M115 383C218 330 373 244 490 174" />
        <circle className="home-orbit-center-glow" cx="300" cy="280" r="82" />
        <circle className="home-orbit-center" cx="300" cy="280" r="64" />
        <text className="home-orbit-center-mark" x="300" y="274" textAnchor="middle">ORVOK</text>
        <text className="home-orbit-center-caption" x="300" y="298" textAnchor="middle">um universo de perspectivas</text>
        <g className="home-orbit-node home-orbit-node-memory">
          <circle cx="300" cy="48" r="35" />
          <text x="300" y="53" textAnchor="middle">memória</text>
        </g>
        <g className="home-orbit-node home-orbit-node-world">
          <circle cx="500" cy="180" r="35" />
          <text x="500" y="185" textAnchor="middle">mundo</text>
        </g>
        <g className="home-orbit-node home-orbit-node-people">
          <circle cx="494" cy="385" r="35" />
          <text x="494" y="390" textAnchor="middle">pessoas</text>
        </g>
        <g className="home-orbit-node home-orbit-node-you">
          <circle cx="105" cy="385" r="35" />
          <text x="105" y="390" textAnchor="middle">você</text>
        </g>
        <g className="home-orbit-node home-orbit-node-choices">
          <circle cx="104" cy="178" r="35" />
          <text x="104" y="183" textAnchor="middle">escolhas</text>
        </g>
        <circle className="home-orbit-dot home-orbit-dot-gold" cx="161" cy="97" r="5" />
        <circle className="home-orbit-dot home-orbit-dot-blue" cx="452" cy="92" r="5" />
        <circle className="home-orbit-dot home-orbit-dot-green" cx="424" cy="467" r="5" />
        <circle className="home-orbit-dot home-orbit-dot-gold" cx="170" cy="466" r="5" />
      </svg>
    </div>
  );
}

const universes = [
  {
    id: "pessoas",
    label: "Pessoas",
    title: "Descubra como pessoas que conhecem você antecipam suas escolhas.",
    href: "/radar",
    action: "Entrar no Radar Humano",
    tone: "people",
  },
  {
    id: "mundo",
    label: "Mundo",
    title: "Faça previsões sobre eventos reais em Economia, Ciência e Tecnologia.",
    href: "/eventos",
    action: "Explorar previsões do mundo",
    tone: "world",
  },
];

const steps = [
  {
    number: "01",
    title: "Você responde",
    description: "Registre perspectivas sobre você, as pessoas e o mundo.",
    href: "/cadastro",
    action: "Começar a responder",
  },
  {
    number: "02",
    title: "Você convida",
    description: "Convide pessoas de confiança com aceite e consentimento.",
    href: "/convites",
    action: "Conhecer os convites",
  },
  {
    number: "03",
    title: "Você descobre",
    description: "Compare respostas e previsões para encontrar padrões.",
    href: "/radar",
    action: "Ver um exemplo",
  },
];

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main id="conteudo" className="home-page">
        <section className="home-hero container" aria-labelledby="hero-title">
          <div className="home-hero-copy">
            <span className="eyebrow">Um espaço de perspectivas humanas</span>
            <h1 id="hero-title" className="display">
              Toda pessoa é um ponto de vista. Toda conexão revela alguma coisa.
            </h1>
            <p className="home-hero-description">
              O ORVOK conecta perspectivas sobre você, sobre as pessoas e sobre o mundo.
            </p>
            <div className="home-hero-actions">
              <Link href="/cadastro" className="button home-primary-button">
                Começar minha jornada <span aria-hidden="true">→</span>
              </Link>
              <Link href="#sobre" className="text-link home-secondary-action">
                Entender o ORVOK <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
          <PerspectiveOrbit />
        </section>

        <section className="home-universes container" aria-labelledby="universes-title">
          <div className="home-section-kicker">
            <span id="universes-title" className="eyebrow">Escolha uma perspectiva</span>
          </div>
          <div className="home-universe-grid">
            {universes.map((universe) => (
              <article className={`home-universe home-universe-${universe.tone}`} key={universe.id} id={universe.id}>
                <div className="home-universe-icon" aria-hidden="true">{universe.tone === "people" ? "◌" : "◒"}</div>
                <div className="home-universe-content">
                  <span className="eyebrow">{universe.label}</span>
                  <h2 className="display">{universe.title}</h2>
                  <Link href={universe.href} className="home-inline-action">
                    {universe.action} <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="como-funciona" className="home-how container" aria-labelledby="how-title">
          <div className="home-section-heading">
            <span className="eyebrow">Como funciona</span>
            <h2 id="how-title" className="display">Uma experiência em três movimentos.</h2>
          </div>
          <div className="home-steps">
            {steps.map((step, index) => (
              <article className="home-step" key={step.number}>
                <div className="home-step-marker" aria-hidden="true">
                  <span>{step.number}</span>
                  {index < steps.length - 1 && <i />}
                </div>
                <div className="home-step-body">
                  <h3 className="display">{step.title}</h3>
                  <p>{step.description}</p>
                  <Link href={step.href} className="home-inline-action">
                    {step.action} <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </article>
            ))}
          </div>
          <p className="home-auth-note">
            <span aria-hidden="true">◌</span> Ações de convite exigem cadastro ou login.
          </p>
        </section>

        <footer id="sobre" className="home-footer">
          <div className="container home-footer-inner">
            <div className="home-footer-brand">
              <span className="brand-word">ORVOK</span>
              <span>Cada perspectiva só existe com aceite e consentimento ativos.</span>
            </div>
            <nav className="home-footer-nav" aria-label="Navegação do rodapé">
              <div>
                <span className="eyebrow">Produto</span>
                <Link href="/radar">Radar Humano</Link>
                <Link href="/eventos">Prever o mundo</Link>
                <Link href="/grupos">Grupos</Link>
              </div>
              <div>
                <span className="eyebrow">Sobre</span>
                <Link href="#sobre">Sobre o ORVOK</Link>
                <Link href="#como-funciona">Como funciona</Link>
                <Link href="#manifesto">Manifesto</Link>
              </div>
              <div>
                <span className="eyebrow">Suporte</span>
                <Link href="#privacidade">Privacidade</Link>
                <Link href="#termos">Termos de uso</Link>
                <Link href="/entrar">Entrar</Link>
                <Link href="/cadastro">Criar conta</Link>
              </div>
            </nav>
          </div>
        </footer>
      </main>
    </>
  );
}
