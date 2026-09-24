import Link from "next/link";
import { SiteHeader } from "../components/SiteHeader";
import { OrvokGlobe } from "../components/OrvokVisualSystem";

function PerspectiveOrbit() {
  return <OrvokGlobe />;
}

const steps = [
  {
    number: "01",
    title: "Você responde",
    description:
      "Registre suas próprias perspectivas sobre você, as pessoas e os acontecimentos do mundo.",
    href: "/cadastro",
    action: "Começar a responder",
    tone: "you",
  },
  {
    number: "02",
    title: "Você convida",
    description:
      "Escolha pessoas que conhecem você e permita que participem com aceite e consentimento.",
    href: "/convites",
    action: "Conhecer os convites",
    tone: "people",
  },
  {
    number: "03",
    title: "Você descobre",
    description:
      "Compare respostas, previsões e percepções para encontrar padrões invisíveis.",
    href: "/radar",
    action: "Ver um exemplo",
    tone: "world",
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
              O ORVOK é um espaço para descobrir como as pessoas percebem você —
              e como você percebe o mundo.
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

        <section
          className="home-universe-band"
          aria-label="Os universos do ORVOK"
        >
          <div className="container home-universe-band-inner">
            <Link href="/radar" className="home-universe-signature">
              <span className="home-globe-icon" aria-hidden="true">
                ◎
              </span>
              <strong>VOCÊ. PESSOAS. MUNDO.</strong>
            </Link>
            <span className="home-band-divider" aria-hidden="true" />
            <p>
              Previsões sobre acontecimentos reais, além da nossa própria
              história.
              <br />
              <Link href="/eventos">
                Faça previsões sobre eventos reais em Economia, Ciência e
                Tecnologia.
              </Link>
            </p>
            <span className="home-band-divider" aria-hidden="true" />
            <div className="home-band-topics" aria-label="Categorias do mundo">
              <Link href="/eventos">▥ Economia</Link>
              <Link href="/eventos">♧ Ciência</Link>
              <Link href="/eventos">▦ Tecnologia</Link>
            </div>
          </div>
        </section>

        <section
          id="como-funciona"
          className="home-how container"
          aria-labelledby="how-title"
        >
          <div className="home-section-heading">
            <span id="how-title" className="eyebrow">
              O que acontece aqui?
            </span>
          </div>
          <div className="home-steps">
            {steps.map((step, index) => (
              <article
                className={`home-step home-step-${step.tone}`}
                key={step.number}
              >
                <div className="home-step-marker" aria-hidden="true">
                  <span>{step.number}</span>
                  {index < steps.length - 1 && <i />}
                </div>
                <div className="home-step-body">
                  <h2 className="display">{step.title}</h2>
                  <p>{step.description}</p>
                  <Link href={step.href} className="home-inline-action">
                    {step.action} <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>

        <footer id="sobre" className="home-footer">
          <div className="container home-footer-inner">
            <div className="home-footer-brand">
              <span className="brand-word">ORVOK</span>
              <span>
                Cada perspectiva só existe com aceite e consentimento ativos.
              </span>
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
