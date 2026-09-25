import { AppShell } from "../../components/app/AppShell";
import { Questionnaire } from "../../components/app/Questionnaire";
export const metadata = { title: "Meu gabarito" };
export default function OnboardingPage() {
  return <AppShell title="Meu gabarito"><Questionnaire /></AppShell>;
}
