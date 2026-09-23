import { SiteHeader } from "../../components/SiteHeader";
import { SocialShell } from "../../components/SocialShell";
import { MathMetricsPanel } from "../../components/MathMetricsPanel";
import { isInternalMathCalculationEnabled } from "../../lib/math-feature-flags";

export default function PerfilPage() {
  const enabled = isInternalMathCalculationEnabled();
  return <><SiteHeader /><SocialShell section="perfil" mathPanel={<MathMetricsPanel enabled={enabled} />} /></>;
}
