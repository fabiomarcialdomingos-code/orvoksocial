import Link from "next/link";
import { AppContextBar } from "../../components/RadarVisuals";
import { SiteHeader } from "../../components/SiteHeader";

const options = [
  "Analiso todas as possibilidades",
  "Confio mais na minha intuição",
  "Converso com alguém de confiança",
  "Prefiro esperar antes de decidir",
];

export default function OnboardingPage() {
  return (
    <>
      <SiteHeader variant="app" />
      <AppContextBar section="Meu gabarito" progress="01 de 12" />
      <main id="conteudo" className="mockup-page question-page container">
        <section className="question-copy" aria-labelledby="question-title">
          <span className="eyebrow">Sua perspectiva</span>
          <h1 id="question-title" className="display">
            O que você costuma fazer quando precisa tomar uma decisão
            importante?
          </h1>
          <p>Responda com calma. Não existe resposta certa.</p>
          <span className="question-rule" aria-hidden="true" />
          <div className="question-atmosphere" aria-hidden="true">
            <span />
            <i />
            <b />
          </div>
          <p className="question-motto">
            PERSPECTIVAS
            <br />
            HOJE.
            <br />
            HORIZONTES
            <br />
            AMANHÃ.
          </p>
        </section>
        <section
          className="question-card"
          aria-labelledby="question-card-title"
        >
          <h2 id="question-card-title" className="sr-only">
            Escolha sua resposta
          </h2>
          <fieldset className="question-options">
            <legend className="sr-only">Escolha uma opção</legend>
            {options.map((option, index) => (
              <label
                className={`question-option ${index === 0 ? "is-selected" : ""}`}
                key={option}
              >
                <input
                  type="radio"
                  name="perspective"
                  value={option}
                  defaultChecked={index === 0}
                />
                <span className="question-radio" aria-hidden="true">
                  {index === 0 ? "✓" : ""}
                </span>
                <span>{option}</span>
                <b aria-hidden="true">{index === 0 ? "✓" : ""}</b>
              </label>
            ))}
          </fieldset>
        </section>
      </main>
      <div
        className="question-controls container"
        aria-label="Controles do questionário"
      >
        <Link href="/radar" className="button button-outline">
          <span aria-hidden="true">←</span> Voltar
        </Link>
        <div className="question-progress">
          <span>1 de 12</span>
          <i>
            <b />
          </i>
        </div>
        <Link href="/radar#responder" className="button button-gold">
          Próxima pergunta <span aria-hidden="true">→</span>
        </Link>
      </div>
    </>
  );
}
