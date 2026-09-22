import { FoundationPage } from "../../components/FoundationPage";
import { AuthForm } from "../../components/AuthForm";
export default function RegisterPage() {
  return (
    <FoundationPage
      eyebrow="Sua conta"
      title="Comece uma nova perspectiva."
      description="Crie sua conta para participar dos fluxos de teste do ORVOK."
    >
      <AuthForm mode="register" />
    </FoundationPage>
  );
}
