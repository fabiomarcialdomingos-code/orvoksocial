import { FoundationPage } from "../../components/FoundationPage";
import { AuthForm } from "../../components/AuthForm";
export default function LoginPage() {
  return (
    <FoundationPage
      eyebrow="Bem-vindo de volta"
      title="Sua perspectiva continua aqui."
      description="Acesse sua conta para acompanhar convites e decisões de consentimento."
    >
      <AuthForm mode="login" />
    </FoundationPage>
  );
}
