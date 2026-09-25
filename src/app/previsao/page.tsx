import { Suspense } from "react";
import { AppShell } from "../../components/app/AppShell";
import { Predict } from "../../components/app/Predict";
export const metadata = { title: "Prever alguém" };
export default function PredictPage() {
  return <AppShell title="Prever alguém"><Suspense><Predict /></Suspense></AppShell>;
}
