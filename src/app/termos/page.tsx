import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "../../components/site/SiteFooter";
import { SiteNav } from "../../components/site/SiteNav";
import s from "../privacidade/privacidade.module.css";

export const metadata: Metadata = {
  title: "Termos de uso",
  description: "As regras de uso do orvok: idade mínima, comportamento esperado e moderação.",
};

const ATUALIZADO_EM = "4 de outubro de 2026";

export default function TermosDeUsoPage() {
  return (
    <>
      <SiteNav />
      <main id="conteudo" className={`container ${s.pagina}`}>
        <header className={s.cabecalho}>
          <span className={s.selo}><i /> Documento público</span>
          <h1>Termos de uso</h1>
          <p>
            Regras simples para o orvok continuar sendo um espaço seguro entre você e as
            pessoas que escolheu. Ao responder um convite, criar uma conta ou compartilhar a sua visão sobre alguém,
            você concorda com o que está escrito aqui.
          </p>
          <p className={s.atualizado}>Última atualização: {ATUALIZADO_EM}.</p>
        </header>

        <div className={s.corpo}>
          <section className={s.secao}>
            <h2>1. Idade mínima</h2>
            <p>
              O orvok é destinado a pessoas com <strong>16 anos ou mais</strong>. Isso vale
              tanto para quem cria um convite quanto para quem responde a um, com ou sem
              conta. Ao aceitar estes termos, você está confirmando que tem 16 anos ou mais.
            </p>
            <p>
              Se um responsável identificar uma conta ou um convite de alguém abaixo dessa
              idade, pode escrever para{" "}
              <a className="text-link" href="mailto:contato@orvok.com.br">contato@orvok.com.br</a>{" "}
              e removemos o quanto antes.
            </p>
          </section>

          <section className={s.secao}>
            <h2>2. O que você não pode fazer no orvok</h2>
            <ul>
              <li>Assediar, ameaçar, perseguir ou constranger outra pessoa.</li>
              <li>Enviar um convite ou uma resposta com conteúdo sexual, violento ou ilegal.</li>
              <li>Se passar por outra pessoa ao responder um convite.</li>
              <li>Usar o orvok para coletar dados de outras pessoas sem que elas saibam.</li>
              <li>Tentar contornar um bloqueio ou continuar contatando quem pediu para não ser contatado.</li>
            </ul>
          </section>

          <section className={s.secao}>
            <h2>3. Denunciar e bloquear</h2>
            <p>
              Quem recebe um convite pode <strong>denunciar</strong> esse convite a qualquer
              momento, direto na tela onde ele aparece. A denúncia chega para uma pessoa de
              verdade revisar — hoje isso é feito manualmente, sem promessa de resposta
              automática ou imediata, porque o orvok ainda é operado por uma única pessoa.
            </p>
            <p>
              Também é possível <strong>bloquear</strong> quem enviou um convite. Depois de
              bloqueado, essa pessoa não consegue mais te enviar novos convites por ali. O
              bloqueio é seu, individual — ele não apaga o convite para quem mais o recebeu.
            </p>
            <p>
              Se uma denúncia mostrar um uso claramente abusivo do orvok, a conta ou o
              convite envolvido pode ser suspenso ou removido, mesmo sem aviso prévio.
            </p>
          </section>

          <section className={s.secao}>
            <h2>Conversas entre pessoas</h2>
            <p>
              Depois que uma conversa do Mundo é revelada, as duas pessoas que participaram
              dela podem propor uma conversa privada. <strong>Ela só começa se a outra pessoa
              aceitar</strong>, e qualquer um dos dois pode encerrá-la quando quiser.
            </p>
            <ul>
              <li>As conversas existem só entre pessoas que deram a opinião uma para a outra. Quem responde de forma anônima sobre o retrato de alguém <strong>nunca</strong> é identificado nem contatado.</li>
              <li>As mensagens são privadas. O orvok <strong>não lê as conversas</strong>: elas só são abertas pela nossa equipe se alguém denunciar aquela conversa.</li>
              <li>As mensagens são apagadas automaticamente depois de <strong>90 dias</strong>.</li>
              <li>Vale tudo o que está na seção &ldquo;O que você não pode fazer no orvok&rdquo;: assédio, ameaça e conteúdo sexual ou ilegal podem levar à suspensão da conta.</li>
            </ul>
          </section>

          <section className={s.secao}>
            <h2>4. O que o orvok não é</h2>
            <div className={s.destaque}>
              <p>
                O orvok é um espaço de autoconhecimento entre pessoas que se conhecem. Não é
                um teste psicológico, não diagnostica nada, e o resultado não deve ser
                usado para tomar decisões sérias sobre alguém.
              </p>
            </div>
          </section>

          <section className={s.secao}>
            <h2>5. Sua conta</h2>
            <ul>
              <li>Você é responsável por manter sua senha em segurança.</li>
              <li>Uma conta é pessoal e não deve ser compartilhada.</li>
              <li>Você pode apagar sua conta a qualquer momento, em <Link className="text-link" href="/meus-dados">Meus dados</Link>.</li>
            </ul>
          </section>

          <section className={s.secao}>
            <h2>6. Mudanças no orvok</h2>
            <p>
              O orvok ainda está em construção e pode mudar, incluindo pausar ou encerrar
              alguma funcionalidade. Se uma mudança afetar o que você já espera do produto,
              avisaremos antes de ela valer para você, como já promete a{" "}
              <Link className="text-link" href="/privacidade">política de privacidade</Link>.
            </p>
          </section>

          <section className={s.secao}>
            <h2>7. Lei aplicável</h2>
            <p>
              Estes termos são regidos pela lei brasileira. Qualquer questão sobre eles pode
              ser resolvida diretamente pelo canal abaixo, antes de qualquer outra via.
            </p>
          </section>

          <div className={s.contato}>
            <div>
              <p style={{ color: "var(--text)", fontWeight: 500 }}>Ficou alguma dúvida?</p>
              <p>Escreva para contato@orvok.com.br. Respondemos pessoalmente.</p>
            </div>
            <a className="button button-secondary" href="mailto:contato@orvok.com.br">Falar com o orvok</a>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
