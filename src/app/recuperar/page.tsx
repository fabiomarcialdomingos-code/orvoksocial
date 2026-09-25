import { AuthForm } from "../../components/AuthForm";
import { AuthLayout } from "../../components/site/AuthLayout";
export const metadata = { title: "Recuperar acesso" };
export default function RecoverPage() {
  return (
    <AuthLayout title="Vamos recuperar o seu acesso." text="Informe o e-mail da conta. Se ele existir, enviaremos um código para criar uma nova senha.">
      <AuthForm mode="request-reset" />
    </AuthLayout>
  );
}
