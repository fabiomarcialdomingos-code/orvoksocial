import { AuthForm } from "../../components/AuthForm";
import { AuthLayout } from "../../components/site/AuthLayout";
export const metadata = { title: "Nova senha" };
export default function NewPasswordPage() {
  return (
    <AuthLayout title="Defina uma nova senha." text="Use o código que chegou por e-mail. Ele vale por pouco tempo e só uma vez.">
      <AuthForm mode="reset-password" />
    </AuthLayout>
  );
}
