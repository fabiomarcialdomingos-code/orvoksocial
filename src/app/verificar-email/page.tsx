import { AuthForm } from "../../components/AuthForm";
import { AuthLayout } from "../../components/site/AuthLayout";
export const metadata = { title: "Verificar e-mail" };
export default function VerifyEmailPage() {
  return (
    <AuthLayout title="Confirme o seu e-mail." text="Cole o código que enviamos. Depois disso, você já pode entrar.">
      <AuthForm mode="verify-email" />
    </AuthLayout>
  );
}
