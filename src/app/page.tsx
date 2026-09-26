import Link from "next/link";
import { LiveClock } from "../components/site/LiveClock";
import { ParticleField } from "../components/site/ParticleField";
import { ScrollEffects } from "../components/site/ScrollEffects";
import styles from "./page.module.css";

export default function HomePage() {
  return (
    <div className={styles.page}>
      <ParticleField />
      <div className={styles.field} aria-hidden="true" />
      <div className={styles.fieldGlow} id="field-glow" />
      <ScrollEffects />

      <div className={styles.topline}>
        <Link href="/" className={styles.toplineWord}>orvok</Link>
        <div className={styles.toplineRight}>
          <span className={styles.clockText}><LiveClock /></span>
          <Link href="/entrar">entrar</Link>
          <Link href="/cadastro">criar conta</Link>
        </div>
      </div>

      <main className={styles.content} id="conteudo">
        <section className={`${styles.opening} ${styles.gutter}`} aria-labelledby="hero-title">
          <div className={styles.openingInner}>
            <span className={styles.kicker}>Privado · por convite · sem ranking público</span>
            <h1 id="hero-title" className={styles.openingTitle}>Veja-se pelos olhos de quem te conhece.</h1>
            <p className={styles.openingLede}>
              Você responde sobre si. Pessoas próximas, com a sua permissão, tentam antecipar essas respostas.
              O ORVOK mostra onde elas acertam, onde você surpreende — e o que isso revela.
            </p>
            <Link href="/cadastro" className={styles.textCta}>Começar pela minha referência →</Link>
          </div>
        </section>

        <section className={`${styles.intro} ${styles.gutter}`} data-reveal>
          <div className={styles.introInner}>
            <span className={styles.kicker}>Um mesmo instrumento</span>
            <h2 className={styles.heading}>Três distâncias, uma leitura.</h2>
            <p className={styles.bodyText}>
              Você ao centro. Pessoas próximas, a uma distância medida em consentimento.
              O mundo, na borda — eventos que ninguém controla. A cor nunca muda de significado.
            </p>
          </div>
        </section>

        <section className={`${styles.flow} ${styles.gutter}`} id="perspectivas">
          <div className={`${styles.flowRow} ${styles.flowRowLead}`} data-reveal>
            <div className={styles.flowInner}>
              <span className={styles.tag}>§ Você</span>
              <h3>A sua referência</h3>
              <p>
                Doze perguntas sobre como você decide, reage e vive. Sem resposta certa.
                As respostas ficam guardadas em versões que não podem ser alteradas às escondidas.
              </p>
            </div>
          </div>

          <div className={`${styles.flowRow} ${styles.flowRowRight}`} data-reveal>
            <div className={styles.flowInner}>
              <span className={styles.tag}>§ Pessoas</span>
              <h3>Quem acerta você?</h3>
              <p>
                Amigos, família ou colegas pedem para prever você. Você aceita, escolhe se quer ver as
                previsões e pode revogar a qualquer momento.
              </p>
              <div className={styles.tally}>
                {([["Bruno", 9], ["Ana", 7], ["Carla", 4]] as const).map(([who, hits]) => (
                  <div key={who} className={styles.tallyRow}>
                    <span>{who}</span>
                    <span className={styles.tallyBar}><i data-tally-fill={`${(hits / 12) * 100}%`} /></span>
                    <span>{hits}/12</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.flowRow} data-reveal>
            <div className={styles.flowInner}>
              <span className={styles.tag}>§ Mundo</span>
              <h3>O que vai acontecer?</h3>
              <p>
                Eventos reais de economia, ciência e tecnologia, com critério de resolução publicado
                antes. Você escolhe um lado e diz o quanto confia.
              </p>
            </div>
          </div>

          <div className={`${styles.flowRow} ${styles.flowRowRight}`} data-reveal>
            <div className={styles.flowInner}>
              <span className={styles.tag}>§ Consentimento</span>
              <h3>Nada acontece sem o seu sim.</h3>
              <p>
                Pedido, aceite e consentimento são etapas separadas. Cada uma fica registrada com a
                versão exata do aviso que você leu.
              </p>
            </div>
          </div>
        </section>

        <section className={`${styles.quote} ${styles.gutter}`} data-reveal>
          <p className={styles.quoteText}>
            &ldquo;Prever alguém que você ama é, antes de tudo, prestar atenção.&rdquo;
          </p>
        </section>

        <section className={`${styles.steps} ${styles.gutter}`} id="steps-section" data-reveal aria-labelledby="como-title">
          <div className={styles.stepsHead}>
            <span className={styles.kicker}>Quatro etapas</span>
            <h2 id="como-title">Da primeira resposta ao encontro.</h2>
          </div>
          <div className={styles.stepList}>
            <div className={styles.fillLine} id="step-fill" />
            <div className={styles.step}>
              <span className={styles.stepNum}>01</span>
              <h4>Responda sobre você</h4>
              <p>Monte a sua referência em poucos minutos.</p>
            </div>
            <div className={styles.step}>
              <span className={styles.stepNum}>02</span>
              <h4>Receba pedidos</h4>
              <p>Quem te conhece pede para te prever usando o seu e-mail.</p>
            </div>
            <div className={styles.step}>
              <span className={styles.stepNum}>03</span>
              <h4>Consinta, ou não</h4>
              <p>Você lê o aviso, aceita e decide se quer ver o resultado.</p>
            </div>
            <div className={styles.step}>
              <span className={styles.stepNum}>04</span>
              <h4>Veja o encontro</h4>
              <p>Compare, pergunta por pergunta, o que cada pessoa antecipou.</p>
            </div>
          </div>
        </section>

        <section className={`${styles.closing} ${styles.gutter}`} id="comecar" data-reveal aria-labelledby="consent-title">
          <div className={styles.closingInner}>
            <span className={styles.kicker}>Privado por padrão</span>
            <h2 id="consent-title">Privado por padrão, auditável sempre.</h2>
            <div className={styles.promises}>
              <p className={styles.promise}>
                <strong>Você controla quem prevê</strong>
                <span>Cada pessoa precisa de um pedido aceito e de um consentimento seu. Revogar esconde as previsões na hora.</span>
              </p>
              <p className={styles.promise}>
                <strong>Nada de ranking de pessoas</strong>
                <span>O ORVOK não publica notas sobre ninguém. O encontro é visível só para você.</span>
              </p>
              <p className={styles.promise}>
                <strong>Seus dados, suas escolhas</strong>
                <span>Exporte tudo o que existe sobre você ou peça exclusão direto na sua conta.</span>
              </p>
            </div>
            <Link href="/cadastro" className={styles.ctaButton}>Criar minha conta</Link>
          </div>
        </section>
      </main>

      <footer className={`${styles.footer} ${styles.gutter}`}>
        <span>ORVOK · perspectivas com consentimento</span>
        <span>© {new Date().getFullYear()}</span>
      </footer>
    </div>
  );
}
