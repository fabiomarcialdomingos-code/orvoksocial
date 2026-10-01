import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "../../components/site/SiteFooter";
import { SiteNav } from "../../components/site/SiteNav";
import s from "./privacidade.module.css";

export const metadata: Metadata = {
  title: "Privacidade",
  description: "Como o orvok trata os dados das pessoas que usam o produto.",
};

const ATUALIZADO_EM = "30 de setembro de 2026";

export default function PoliticaPrivacidadePage() {
  return (
    <>
      <SiteNav />
      <main id="conteudo" className={`container ${s.pagina}`}>
        <header className={s.cabecalho}>
          <span className={s.selo}><i /> Documento público</span>
          <h1>Política de privacidade</h1>
          <p>
            O orvok existe para uma coisa: ajudar você a descobrir como as pessoas que
            escolheu enxergam você, e como vocês enxergam o mundo juntos. Isso só funciona
            com confiança. Este documento explica, sem juridiquês, quais dados o orvok
            guarda, por quê, e o que você pode fazer a respeito a qualquer momento.
          </p>
          <p className={s.atualizado}>Última atualização: {ATUALIZADO_EM}.</p>
        </header>

        <div className={s.corpo}>
          <section className={s.secao}>
            <h2>1. Quem é responsável pelo orvok</h2>
            <p>
              O orvok é operado por <strong>Fabio Marcial Domingos</strong>, pessoa
              física, com sede no Brasil. O orvok ainda não tem uma empresa formalmente
              aberta; enquanto isso não acontece, o responsável pelo tratamento dos seus
              dados, para todos os efeitos desta política e da Lei Geral de Proteção de
              Dados (LGPD), é essa pessoa. Se e quando uma empresa for aberta para o orvok,
              esta página será atualizada e você será avisado na primeira vez que entrar
              depois da mudança.
            </p>
            <p>
              Para qualquer assunto de privacidade, o canal oficial é:{" "}
              <a className="text-link" href="mailto:contato@orvok.com.br">contato@orvok.com.br</a>.
            </p>
          </section>

          <section className={s.secao}>
            <h2>2. O que o orvok guarda sobre você</h2>
            <p>Só o que é necessário para o orvok funcionar. Em detalhe:</p>
            <ul>
              <li>
                <strong>O nome que você usa no orvok.</strong> Pode ser um apelido; o orvok
                não pede documento nem nome completo obrigatório.
              </li>
              <li>
                <strong>Suas respostas nos desafios</strong> — as escolhas que você faz sobre
                si mesmo — e <strong>as previsões que você faz sobre outras pessoas</strong>.
              </li>
              <li>
                <strong>E-mail e senha</strong>, se você cria uma conta com e-mail, ou o{" "}
                <strong>identificador da sua conta Google</strong>, se você entra com o
                Google. O orvok nunca vê nem guarda a sua senha do Google.
              </li>
              <li>
                <strong>Um código no seu aparelho</strong> (um cookie), para que um desafio
                respondido sem conta continue seu quando você criar uma conta depois. Esse
                código não identifica você, só o aparelho.
              </li>
              <li>
                <strong>Registros técnicos básicos</strong> (data e hora de acesso, tipo de
                aparelho), usados só para segurança e para corrigir problemas.
              </li>
            </ul>
          </section>

          <section className={s.secao}>
            <h2>3. O que o orvok nunca faz</h2>
            <div className={s.destaque}>
              <p>O orvok não vende os seus dados. Nunca. Para ninguém.</p>
            </div>
            <ul style={{ marginTop: "var(--s5)" }}>
              <li>Não mostra suas respostas para quem você não autorizou.</li>
              <li>
                Não usa números inflados ou atividade fingida para parecer mais movimentado
                do que realmente está.
              </li>
              <li>
                Não monta um perfil psicológico ou clínico seu — o que o orvok mostra sobre
                &ldquo;como você se vê&rdquo; é uma brincadeira de autoconhecimento entre
                amigos, não um diagnóstico.
              </li>
              <li>Não publica ranking público comparando quem conhece mais gente.</li>
            </ul>
          </section>

          <section className={s.secao}>
            <h2>4. Por que o orvok guarda esses dados</h2>
            <p>
              Todo dado listado acima existe para uma finalidade concreta: fazer o desafio
              funcionar (guardar e comparar respostas), manter sua conta segura (senha,
              sessão), evitar fraude e abuso, e cumprir obrigações legais quando exigido por
              lei. O orvok trata seus dados com base no seu consentimento (quando você
              responde um desafio ou cria conta), na execução do próprio serviço que você
              pediu, e no interesse legítimo de manter a plataforma segura — sempre dentro
              dos limites da LGPD.
            </p>
          </section>

          <section className={s.secao}>
            <h2>5. Com quem seus dados são compartilhados</h2>
            <p>Só com prestadores que ajudam o orvok a existir tecnicamente:</p>
            <ul>
              <li><strong>Vercel</strong>, que hospeda o site.</li>
              <li>
                <strong>Neon</strong>, que hospeda o banco de dados, em servidores na região
                de São Paulo (Brasil).
              </li>
              <li>
                <strong>Google</strong>, somente se você escolher entrar com sua conta
                Google — nesse caso, o Google trata os dados de login conforme a própria
                política de privacidade dele.
              </li>
            </ul>
            <p>
              Quando você compartilha um convite pelo WhatsApp, o orvok não envia nada para
              o WhatsApp ou para a Meta: ele só abre a conversa com um texto e um link
              prontos, do mesmo jeito que aconteceria se você copiasse e colasse essa
              mensagem você mesmo.
            </p>
          </section>

          <section className={s.secao}>
            <h2>6. Onde os dados ficam guardados</h2>
            <p>
              O banco de dados do orvok fica hospedado no Brasil. Não transferimos seus
              dados pessoais para fora do país, com a única exceção do login pelo Google,
              que é operado pelo próprio Google e pode envolver servidores fora do Brasil —
              nesse caso, quem trata esse dado é o Google, não o orvok.
            </p>
          </section>

          <section className={s.secao}>
            <h2>7. Por quanto tempo os dados ficam guardados</h2>
            <ul>
              <li>
                Um desafio criado sem conta fica disponível por <strong>60 dias</strong>. Depois
                disso, ele deixa de poder ser respondido.
              </li>
              <li>
                Se você cria uma conta, seus dados ficam guardados enquanto a conta existir.
              </li>
              <li>
                Se você cancela um convite ou apaga sua conta, os dados correspondentes são
                removidos ou tornados inacessíveis, salvo o que a lei exigir manter por mais
                tempo (por exemplo, registros de segurança).
              </li>
            </ul>
          </section>

          <section className={s.secao}>
            <h2>8. Como o orvok protege seus dados</h2>
            <p>
              A conexão com o orvok é sempre criptografada (https). Senhas nunca são
              guardadas em texto simples — passam por um processo de criptografia que torna
              impossível descobrir a senha original. O acesso ao banco de dados é dividido
              em permissões estritas: cada parte do sistema só enxerga o que precisa para
              funcionar, e não mais que isso.
            </p>
          </section>

          <section className={s.secao}>
            <h2>9. Seus direitos</h2>
            <p>
              De acordo com a LGPD, você pode, a qualquer momento e sem custo, pedir para o
              orvok:
            </p>
            <ul>
              <li>confirmar se guardamos dados seus, e mostrar quais são;</li>
              <li>corrigir dados incompletos ou desatualizados;</li>
              <li>apagar dados que você não quer mais que existam;</li>
              <li>receber uma cópia dos seus dados, em formato que você possa reutilizar;</li>
              <li>revogar um consentimento dado anteriormente;</li>
              <li>saber com quem seus dados são compartilhados.</li>
            </ul>
            <p>
              A forma mais rápida de exercer qualquer um desses direitos é pela própria
              conta, em <Link className="text-link" href="/meus-dados">Meus dados</Link>, onde
              é possível baixar ou pedir a exclusão diretamente. Se preferir, ou se ainda não
              tiver conta, escreva para o e-mail abaixo.
            </p>
          </section>

          <section className={s.secao}>
            <h2>10. Crianças e adolescentes</h2>
            <p>
              O orvok é destinado a pessoas com <strong>16 anos ou mais</strong>, como
              descrevem os <Link className="text-link" href="/termos">Termos de uso</Link>.
              Não coletamos intencionalmente dados de crianças ou adolescentes abaixo dessa
              idade. Pais ou responsáveis que identificarem uma conta ou um desafio de
              alguém mais novo podem escrever para{" "}
              <a className="text-link" href="mailto:contato@orvok.com.br">contato@orvok.com.br</a>{" "}
              para que os dados sejam removidos.
            </p>
          </section>

          <section className={s.secao}>
            <h2>11. Cookies</h2>
            <p>
              O orvok usa cookies estritamente necessários: um para manter você conectado à
              sua conta, e outro para lembrar um desafio respondido antes de você ter conta.
              Não usamos cookies de propaganda nem de rastreamento por outros sites.
            </p>
          </section>

          <section className={s.secao}>
            <h2>12. Mudanças nesta política</h2>
            <p>
              Se esta política mudar de um jeito que afete o que você já espera do orvok, o
              site vai te avisar claramente na próxima vez que você entrar, antes de a
              mudança valer para você.
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
