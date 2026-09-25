export const dynamic = "force-dynamic";
import { AppShell } from "../../components/app/AppShell";
import { ProfileView } from "../../components/app/Community";
import { MathMetricsPanel } from "../../components/MathMetricsPanel";
import { isInternalMathCalculationEnabled } from "../../lib/math-feature-flags";
export const metadata = { title: "Perfil" };
export default function ProfilePage() {
  return <AppShell title="Perfil"><ProfileView mathPanel={<MathMetricsPanel enabled={isInternalMathCalculationEnabled()} />} /></AppShell>;
}
