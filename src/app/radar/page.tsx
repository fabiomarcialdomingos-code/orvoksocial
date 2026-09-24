import { RadarWorkspace } from "../../components/RadarWorkspace";
import { SiteHeader } from "../../components/SiteHeader";

const steps = [
  ["01", "Responda sobre você", "/radar#responder"],
  ["02", "Convide alguém", "/convites"],
  ["03", "Receba uma previsão", "/previsao"],
  ["04", "Veja o encontro", "/resultado"],
] as const;

export default function RadarPage() {
  return (
    <>
      <SiteHeader />
      <main id="conteudo" className="container radar-main radar-page">
        <section className="radar-hero-frozen" aria-labelledby="radar-title">
          <div className="radar-hero-copy">
            <span className="eyebrow">Uma cartografia do olhar</span>
            <h1 id="radar-title" className="display">Pensamentos diferentes. Uma perspectiva compartilhada.</h1>
            <p className="muted">O Radar revela onde as pessoas que conhecem você se aproximam e antecipam suas escolhas.</p>
            <div className="hero-actions">
              <a href="#responder" className="button">Explorar meu Radar <span aria-hidden="true">→</span></a>
              <a href="#como-funciona" className="text-link">Como funciona</a>
            </div>
          </div>
          <div className="radar-hero-visual" aria-hidden="true">
            <span className="radar-sphere-label">VOCÊ</span>
            <i className="radar-node radar-node-a">Ana</i>
            <i className="radar-node radar-node-b">Marcos</i>
            <i className="radar-node radar-node-c">Júlia</i>
            <i className="radar-node radar-node-d">Padrões</i>
          </div>
        </section>
        <section id="como-funciona" className="radar-journey-strip" aria-labelledby="radar-journey-title">
          <div className="radar-journey-heading">
            <span id="radar-journey-title" className="eyebrow">Como o Radar funciona</span>
            <span className="muted">Quatro passos para transformar perspectivas em clareza.</span>
          </div>
          <div className="radar-journey-grid">
            {steps.map(([number, label, href], index) => (
              <a href={href} className={`radar-journey-step ${index === 0 ? "is-active" : ""}`} key={number}>
                <span>{number}</span>
                <strong>{label}</strong>
              </a>
            ))}
          </div>
        </section>
        <RadarWorkspace />
      </main>
    </>
  );
}
