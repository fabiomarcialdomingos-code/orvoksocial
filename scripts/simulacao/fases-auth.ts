// Autenticação em profundidade. Só roda onde o segredo do servidor está disponível (ambiente local),
// porque chama o serviço de login do Google direto: não existe Google de mentira para usar pela API.
import { Pool } from "pg";
import { AuthService } from "@/lib/auth/service";
import { Ator, RUN, SENHA, achado, emailDe, fase, http, verificar } from "./nucleo";

export async function autenticacaoEmProfundidade(): Promise<void> {
  fase("3b. Autenticação em profundidade (só local)");
  if (!process.env.AUTH_SECRET || !process.env.AUTH_DATABASE_URL) {
    achado("info", "Sequestro prévio de conta não foi exercitado nesta execução", "Exige o segredo do servidor (AUTH_SECRET), que só existe no ambiente local. Foi verificado na simulação local.");
    return;
  }
  const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL, max: 2 });
  const auth = new AuthService(pool);
  try {
    // 1) O atacante cadastra o e-mail da vítima com uma senha dele.
    const email = emailDe(90);
    const atacante = new Ator("atacante", "anon");
    const cad = await http(atacante, "POST", "/api/v1/auth/register", { corpo: { email, password: SENHA } });
    verificar("o atacante cadastra o e-mail da vítima (o orvok não confirma que o e-mail é dele)", cad.status === 202, `status ${cad.status}`);
    const entrouAntes = await http(atacante, "POST", "/api/v1/auth/login", { corpo: { email, password: SENHA } });
    const confirmacaoLigada = process.env.AUTH_REQUIRE_EMAIL_VERIFICATION === "1";
    if (confirmacaoLigada) verificar("com a confirmação de e-mail ligada, o atacante NÃO entra (a conta não está verificada)", entrouAntes.status === 401, `status ${entrouAntes.status}`);
    else verificar("e já consegue entrar nessa conta (sem confirmação de e-mail)", entrouAntes.status === 200, `status ${entrouAntes.status}`);
    // 2) A vítima entra com o Google (e-mail realmente dela, verificado pelo Google).
    const r = await auth.loginWithGoogle({ subject: `sim-google-${RUN}`, email, emailVerified: true });
    verificar("a vítima entra com o Google e a conta existente é reaproveitada (linked)", r.linked === true, JSON.stringify({ linked: r.linked }));
    // 3) O atacante ainda entra?
    const depois = await http(new Ator("atacante2", "anon"), "POST", "/api/v1/auth/login", { corpo: { email, password: SENHA } });
    const sessaoAntiga = confirmacaoLigada ? { status: 401 } : await http(atacante, "GET", "/api/v1/users/me");
    const pegou = depois.status === 200;
    verificar("depois que a vítima entra com o Google, a senha do atacante deixa de valer", !pegou, `login do atacante: status ${depois.status}`);
    verificar("e a sessão que o atacante já tinha é encerrada", sessaoAntiga.status === 401, `status ${sessaoAntiga.status}`);
    if (pegou || sessaoAntiga.status === 200) achado("alto", "Sequestro prévio de conta (pre-hijacking) é possível", "O atacante cadastra o e-mail da vítima com uma senha dele (não há confirmação de e-mail). Quando a vítima entra com o Google, o orvok junta o Google à conta existente e NÃO apaga a senha do atacante nem encerra as sessões dele. O atacante continua com acesso à conta da vítima e a tudo que ela guardar. Correção: ao juntar o Google a uma conta com senha criada sem confirmação de e-mail, apagar a senha e revogar as sessões; ou passar a confirmar o e-mail no cadastro.");
  } finally { await pool.end(); }
}
