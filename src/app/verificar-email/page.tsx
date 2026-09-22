import { FoundationPage } from "../../components/FoundationPage";
import { AuthForm } from "../../components/AuthForm";
export default function VerifyPage() {
  return (
    <FoundationPage
      eyebrow="Segurança da conta"
      title="Confirme seu e-mail."
      description="Digite o código recebido para concluir a verificação do endereço."
    >
      <AuthForm mode="verify-email" />
    </FoundationPage>
  );
}
