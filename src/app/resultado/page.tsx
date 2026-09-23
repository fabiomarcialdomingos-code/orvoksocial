import { FoundationPage } from "../../components/FoundationPage";

export default function ResultPage() {
  return <FoundationPage eyebrow="Resultado · TEST_ONLY" title="Resultado estrutural" description="Resultados de teste preservam snapshots e histórico sem publicar métricas matemáticas."><section className="empty-state" aria-labelledby="result-status"><h2 id="result-status">Nenhum resultado selecionado</h2><p className="muted">Abra um evento resolvido ou um snapshot para consultar o registro autorizado.</p><a className="button" href="/eventos">Ver calendário</a></section></FoundationPage>;
}
