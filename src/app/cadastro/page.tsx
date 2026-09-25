import { AuthForm } from "../../components/AuthForm";
import { AuthLayout, AuthSwitch } from "../../components/site/AuthLayout";
export const metadata = { title: "Criar conta" };
export default function RegisterPage() {
  return (
    <AuthLayout title="Comece pelo que só você sabe." text="Crie a conta e responda às doze perguntas do seu gabarito. Leva uns cinco minutos."
      footer={<AuthSwitch question="Já tem conta?" href="/entrar" action="Entrar" />}>
      <AuthForm mode="register" />
    </AuthLayout>
  );
}
