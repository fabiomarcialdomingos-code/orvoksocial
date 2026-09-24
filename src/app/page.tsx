import Link from "next/link";
import Image from "next/image";
import { SiteHeader } from "../components/SiteHeader";

function PerspectiveOrbit() {
  return (
    <div className="home-orbit" aria-label="Universo de perspectivas ORVOK">
      <Image src="/orvok-globe-approved.png" alt="Esferas translúcidas conectadas ao redor do universo ORVOK" width={1380} height={885} priority />
      {/* The SVG definition remains below as an accessible fallback reference for browsers that do not load the asset. */}
      <svg className="home-orbit-fallback" viewBox="0 0 760 600" role="img" aria-labelledby="orbit-title orbit-desc">
        <title id="orbit-title">ORVOK: você, pessoas e mundo em perspectiva</title>
        <desc id="orbit-desc">Uma esfera ORVOK conectada a diferentes perspectivas humanas e eventos do mundo.</desc>
        <defs>
          <radialGradient id="orb-glow" cx="50%" cy="45%" r="58%">
            <stop offset="0" stopColor="#fffef9" stopOpacity=".98" />
            <stop offset=".45" stopColor="#f6e8ca" stopOpacity=".7" />
            <stop offset="1" stopColor="#dfeaf0" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="orb-you"><stop stopColor="#fff0d0" stopOpacity=".92" /><stop offset="1" stopColor="#e5bd79" stopOpacity=".72" /></radialGradient>
          <radialGradient id="orb-memory"><stop stopColor="#dceddd" stopOpacity=".92" /><stop offset="1" stopColor="#aac9b1" stopOpacity=".72" /></radialGradient>
          <radialGradient id="orb-blue"><stop stopColor="#dcecf6" stopOpacity=".94" /><stop offset="1" stopColor="#a9cce2" stopOpacity=".72" /></radialGradient>
          <filter id="orb-blur"><feGaussianBlur stdDeviation="12" /></filter>
        </defs>
        <ellipse className="home-orbit-line home-orbit-outer" cx="386" cy="298" rx="330" ry="238" />
        <ellipse className="home-orbit-line home-orbit-blue-line" cx="386" cy="298" rx="280" ry="202" transform="rotate(27 386 298)" />
        <ellipse className="home-orbit-line home-orbit-gold-line" cx="386" cy="298" rx="270" ry="178" transform="rotate(-26 386 298)" />
        <ellipse className="home-orbit-line home-orbit-gold-line" cx="386" cy="298" rx="260" ry="132" transform="rotate(12 386 298)" />
        <path className="home-orbit-thread" d="M87 204C256 273 464 381 674 412" />
        <path className="home-orbit-thread" d="M106 437C286 365 469 238 660 144" />
        <circle className="home-orbit-glow" cx="386" cy="298" r="134" fill="url(#orb-glow)" filter="url(#orb-blur)" />
        <circle className="home-orbit-center" cx="386" cy="298" r="91" />
        <g className="home-orbit-brand-mark">
          <circle cx="366" cy="278" r="20" /><circle cx="406" cy="278" r="20" />
          <text x="386" y="337" textAnchor="middle">ORVOK</text>
        </g>
        <g className="home-orbit-node home-orbit-you"><circle cx="188" cy="414" r="48" fill="url(#orb-you)" /><text x="188" y="420" textAnchor="middle">você</text></g>
        <g className="home-orbit-node home-orbit-memory"><circle cx="552" cy="130" r="55" fill="url(#orb-memory)" /><text x="552" y="136" textAnchor="middle">memória</text></g>
        <g className="home-orbit-node home-orbit-choice"><circle cx="219" cy="174" r="48" fill="url(#orb-blue)" /><text x="219" y="180" textAnchor="middle">escolhas</text></g>
        <g className="home-orbit-node home-orbit-world"><circle cx="642" cy="288" r="52" fill="url(#orb-blue)" /><text x="642" y="294" textAnchor="middle">mundo</text></g>
        <g className="home-orbit-node home-orbit-other"><circle cx="520" cy="455" r="45" fill="#eef1f0" fillOpacity=".92" /><text x="520" y="461" textAnchor="middle">outro</text></g>
        <g className="home-orbit-node home-orbit-event home-orbit-economy"><circle cx="386" cy="47" r="43" fill="#fffefa" fillOpacity=".82" /><text x="386" y="53" textAnchor="middle">Economia</text></g>
        <g className="home-orbit-node home-orbit-event home-orbit-science"><circle cx="710" cy="190" r="40" fill="#f4f3ed" fillOpacity=".8" /><text x="710" y="196" textAnchor="middle">Ciência</text></g>
        <g className="home-orbit-node home-orbit-event home-orbit-tech"><circle cx="672" cy="478" r="42" fill="url(#orb-blue)" /><text x="672" y="484" textAnchor="middle">Tecnologia</text></g>
        <circle className="home-orbit-dot home-orbit-dot-gold" cx="101" cy="316" r="6" /><circle className="home-orbit-dot home-orbit-dot-blue" cx="286" cy="94" r="5" /><circle className="home-orbit-dot home-orbit-dot-gold" cx="545" cy="68" r="6" /><circle className="home-orbit-dot home-orbit-dot-green" cx="445" cy="495" r="7" /><circle className="home-orbit-dot home-orbit-dot-blue" cx="90" cy="258" r="6" />
      </svg>
    </div>
  );
}

const steps = [
  { number: "01", title: "Você responde", description: "Registre suas próprias perspectivas sobre você, as pessoas e os acontecimentos do mundo.", href: "/cadastro", action: "Começar a responder", tone: "you" },
  { number: "02", title: "Você convida", description: "Escolha pessoas que conhecem você e permita que participem com aceite e consentimento.", href: "/convites", action: "Conhecer os convites", tone: "people" },
  { number: "03", title: "Você descobre", description: "Compare respostas, previsões e percepções para encontrar padrões invisíveis.", href: "/radar", action: "Ver um exemplo", tone: "world" },
];

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main id="conteudo" className="home-page">
        <section className="home-hero container" aria-labelledby="hero-title">
          <div className="home-hero-copy">
            <span className="eyebrow">Um espaço de perspectivas humanas</span>
            <h1 id="hero-title" className="display">Toda pessoa é um ponto de vista. Toda conexão revela alguma coisa.</h1>
            <p className="home-hero-description">O ORVOK é um espaço para descobrir como as pessoas percebem você — e como você percebe o mundo.</p>
            <div className="home-hero-actions">
              <Link href="/cadastro" className="button home-primary-button">Começar minha jornada <span aria-hidden="true">→</span></Link>
              <Link href="#sobre" className="text-link home-secondary-action">Entender o ORVOK <span aria-hidden="true">→</span></Link>
            </div>
          </div>
          <PerspectiveOrbit />
        </section>

        <section className="home-universe-band" aria-label="Os universos do ORVOK">
          <div className="container home-universe-band-inner">
            <Link href="/radar" className="home-universe-signature"><span className="home-globe-icon" aria-hidden="true">◎</span><strong>VOCÊ. PESSOAS. MUNDO.</strong></Link>
            <span className="home-band-divider" aria-hidden="true" />
            <p>Previsões sobre acontecimentos reais, além da nossa própria história.<br /><Link href="/eventos">Faça previsões sobre eventos reais em Economia, Ciência e Tecnologia.</Link></p>
            <span className="home-band-divider" aria-hidden="true" />
            <div className="home-band-topics" aria-label="Categorias do mundo"><Link href="/eventos">▥ Economia</Link><Link href="/eventos">♧ Ciência</Link><Link href="/eventos">▦ Tecnologia</Link></div>
          </div>
        </section>

        <section id="como-funciona" className="home-how container" aria-labelledby="how-title">
          <div className="home-section-heading"><span id="how-title" className="eyebrow">O que acontece aqui?</span></div>
          <div className="home-steps">
            {steps.map((step, index) => <article className={`home-step home-step-${step.tone}`} key={step.number}>
              <div className="home-step-marker" aria-hidden="true"><span>{step.number}</span>{index < steps.length - 1 && <i />}</div>
              <div className="home-step-body"><h2 className="display">{step.title}</h2><p>{step.description}</p><Link href={step.href} className="home-inline-action">{step.action} <span aria-hidden="true">→</span></Link></div>
            </article>)}
          </div>
        </section>

        <footer id="sobre" className="home-footer"><div className="container home-footer-inner"><div className="home-footer-brand"><span className="brand-word">ORVOK</span><span>Cada perspectiva só existe com aceite e consentimento ativos.</span></div><nav className="home-footer-nav" aria-label="Navegação do rodapé"><div><span className="eyebrow">Produto</span><Link href="/radar">Radar Humano</Link><Link href="/eventos">Prever o mundo</Link><Link href="/grupos">Grupos</Link></div><div><span className="eyebrow">Sobre</span><Link href="#sobre">Sobre o ORVOK</Link><Link href="#como-funciona">Como funciona</Link><Link href="#manifesto">Manifesto</Link></div><div><span className="eyebrow">Suporte</span><Link href="#privacidade">Privacidade</Link><Link href="#termos">Termos de uso</Link><Link href="/entrar">Entrar</Link><Link href="/cadastro">Criar conta</Link></div></nav></div></footer>
      </main>
    </>
  );
}
