import { FoundationPage } from "../../components/FoundationPage";
import { AuthForm } from "../../components/AuthForm";
export default function ResetPage() {
  return (
    <FoundationPage
      eyebrow="Acesso à conta"
      title="Defina uma nova senha."
      description="Use o código de recuperação recebido por e-mail."
    >
      <AuthForm mode="reset-password" />
    </FoundationPage>
  );
}
