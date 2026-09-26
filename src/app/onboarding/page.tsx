import { AppShell } from "../../components/app/AppShell";
import { Questionnaire } from "../../components/app/Questionnaire";
export const metadata = { title: "Minha referência" };
export default function OnboardingPage() {
  return <AppShell title="Minha referência"><Questionnaire /></AppShell>;
}
