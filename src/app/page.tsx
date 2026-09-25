import Link from "next/link";
import { SiteNav } from "../components/site/SiteNav";
import { SiteFooter } from "../components/site/SiteFooter";
import { Instrument, type InstrumentNode } from "../components/ui/Instrument";

const heroNodes: InstrumentNode[] = [
  { id: "you", label: "Você", p: "self", r: 0, angle: 0, size: 9 },
  { id: "ana", label: "Ana, amiga de infância", p: "people", r: 0.42, angle: -58, linked: true },
  { id: "bruno", label: "Bruno, irmão", p: "people", r: 0.3, angle: 22, linked: true },
  { id: "carla", label: "Carla, do trabalho", p: "people", r: 0.58, angle: 118, linked: true },
  { id: "diego", p: "people", r: 0.7, angle: 196, size: 4 },
  { id: "selic", label: "Selic em 2026", p: "world", r: 0.86, angle: -12, size: 5 },
  { id: "artemis", label: "Artemis III", p: "world", r: 0.92, angle: 70, size: 5 },
  { id: "drex", label: "Drex ao público", p: "world", r: 0.84, angle: 160, size: 5 },
  { id: "clima", p: "world", r: 0.95, angle: 238, size: 4 },
  { id: "c1", p: "people", r: 0.5, angle: 262, size: 3.5 },
  { id: "c2", p: "world", r: 0.78, angle: 300, size: 3.5 },
];

export default function HomePage() {
  return (
    <>
      <SiteNav />
      <main id="conteudo">
        <section className="container hero" aria-labelledby="hero-title">
          <div>
            <h1 id="hero-title" className="display">Veja-se pelos olhos de quem te conhece.</h1>
            <p className="lede">
              Você responde sobre si. Pessoas próximas, com a sua permissão, tentam antecipar essas respostas.
              O ORVOK mostra onde elas acertam, onde você surpreende e o que isso revela.
            </p>
            <div className="hero-actions">
              <Link href="/cadastro" className="button" data-p="self">Começar pelo meu gabarito</Link>
              <Link href="#como-funciona" className="button button-secondary">Ver como funciona</Link>
            </div>
            <div className="hero-legend" aria-label="Legenda do radar">
              <span data-p="self"><i className="dot" />Você</span>
              <span data-p="people"><i className="dot" />Pessoas que te conhecem</span>
              <span data-p="world"><i className="dot" />Acontecimentos do mundo</span>
            </div>
          </div>
          <div className="hero-instrument">
            <Instrument nodes={heroNodes} label="Radar com você no centro, pessoas próximas no meio e acontecimentos do mundo na borda" />
          </div>
        </section>

        <section id="perspectivas" className="section" aria-labelledby="perspectivas-title">
          <div className="container">
            <div className="section-head">
              <h2 id="perspectivas-title" className="display">Três distâncias, um mesmo instrumento.</h2>
              <p className="lede">Do que só você sabe ao que ninguém sabe ainda. Cada perspectiva tem a sua cor, e ela nunca muda de significado.</p>
            </div>
            <div className="bento">
              <article className="card lit bento-self" data-p="self">
                <div>
                  <span className="eyebrow">Você</span>
                  <h3>O seu gabarito</h3>
                </div>
                <div className="figure" aria-hidden="true">
                  <svg viewBox="0 0 200 200" width="180">
                    {[30, 55, 80].map((r) => <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="var(--line-strong)" />)}
                    <circle cx="100" cy="100" r="26" fill="var(--self)" opacity="0.12" />
                    <circle cx="100" cy="100" r="10" fill="var(--self)" />
                  </svg>
                </div>
                <p>Doze perguntas sobre como você decide, reage e vive. Sem resposta certa. As respostas ficam guardadas em versões que não podem ser alteradas às escondidas.</p>
              </article>
              <article className="card lit bento-people" data-p="people">
                <div>
                  <span className="eyebrow">Pessoas</span>
                  <h3>Quem acerta você?</h3>
                </div>
                <p>Amigos, família ou colegas pedem para prever você. Você aceita, escolhe se quer ver as previsões e pode revogar a qualquer momento. Depois, o encontro mostra pergunta por pergunta quem te leu bem.</p>
                <div className="stack" aria-hidden="true" style={{ gap: 10 }}>
                  {[["Bruno", 9], ["Ana", 7], ["Carla", 4]].map(([who, hits]) => (
                    <div key={who} className="row" style={{ gap: 12 }}>
                      <span className="faint" style={{ width: 52, fontSize: 13 }}>{who}</span>
                      <div className="meter" style={{ flex: 1 }}><i style={{ width: `${(Number(hits) / 12) * 100}%` }} /></div>
                      <span className="faint" style={{ fontSize: 13 }}>{hits} de 12</span>
                    </div>
                  ))}
                </div>
              </article>
              <article className="card lit bento-world" data-p="world">
                <div>
                  <span className="eyebrow">Mundo</span>
                  <h3>O que vai acontecer?</h3>
                </div>
                <p>Eventos reais de economia, ciência e tecnologia, com critério de resolução publicado antes. Você escolhe um lado e diz o quanto confia.</p>
              </article>
              <article className="card lit bento-consent">
                <div>
                  <span className="eyebrow">Consentimento</span>
                  <h3>Nada acontece sem o seu sim.</h3>
                </div>
                <p>Pedido, aceite e consentimento são etapas separadas. Cada uma fica registrada com a versão exata do aviso que você leu.</p>
              </article>
            </div>
          </div>
        </section>

        <section id="como-funciona" className="section" aria-labelledby="como-title">
          <div className="container">
            <div className="section-head">
              <h2 id="como-title" className="display">Da primeira resposta ao encontro.</h2>
              <p className="lede">Quatro etapas, sempre nesta ordem. Nenhuma previsão existe antes do seu consentimento, e quem prevê nunca vê as suas respostas.</p>
            </div>
            <ol className="steps">
              <li className="step" data-p="self"><h3>Responda sobre você</h3><p>Monte o seu gabarito em poucos minutos.</p></li>
              <li className="step" data-p="people"><h3>Receba pedidos</h3><p>Quem te conhece pede para te prever usando o seu e-mail.</p></li>
              <li className="step" data-p="people"><h3>Consinta, ou não</h3><p>Você lê o aviso, aceita e decide se quer ver o resultado.</p></li>
              <li className="step" data-p="people"><h3>Veja o encontro</h3><p>Compare, pergunta por pergunta, o que cada pessoa antecipou.</p></li>
            </ol>
          </div>
        </section>

        <section id="consentimento" className="section" aria-labelledby="consent-title">
          <div className="container">
            <div className="section-head">
              <h2 id="consent-title" className="display">Privado por padrão, auditável sempre.</h2>
              <div><Link href="/cadastro" className="button" data-p="self">Criar minha conta</Link></div>
            </div>
            <div className="promise">
              <p><strong>Você controla quem prevê</strong>Cada pessoa precisa de um pedido aceito e de um consentimento seu. Revogar esconde as previsões na hora.</p>
              <p><strong>Nada de ranking de pessoas</strong>O ORVOK não publica notas sobre ninguém. O encontro é visível só para você.</p>
              <p><strong>Seus dados, suas escolhas</strong>Exporte tudo o que existe sobre você ou peça exclusão direto na sua conta.</p>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
