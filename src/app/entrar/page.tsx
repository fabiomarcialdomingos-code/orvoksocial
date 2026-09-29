import { AuthForm } from "../../components/AuthForm";
import { AuthLayout, AuthSwitch } from "../../components/site/AuthLayout";
export const metadata = { title: "Entrar" };
export default function LoginPage() {
  return (
    <AuthLayout title="Sua perspectiva continua aqui." text="Entre para acompanhar convites, conversas e novas descobertas."
      footer={<AuthSwitch question="Ainda não tem conta?" href="/cadastro" action="Criar conta" />}>
      <AuthForm mode="login" />
    </AuthLayout>
  );
}
