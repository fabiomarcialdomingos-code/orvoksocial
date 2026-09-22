import { FoundationPage } from "../../components/FoundationPage";
import { AuthForm } from "../../components/AuthForm";
export default function RecoveryPage() {
  return (
    <FoundationPage
      eyebrow="Acesso à conta"
      title="Recupere seu acesso."
      description="Informe o e-mail da conta. Por segurança, a confirmação será a mesma para contas existentes ou não."
    >
      <AuthForm mode="request-reset" />
    </FoundationPage>
  );
}
