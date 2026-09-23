import { FoundationPage } from "../../components/FoundationPage";

export default function ReciprocityPage() {
  return <FoundationPage eyebrow="Radar Humano · TEST_ONLY" title="Reciprocidade" description="A reciprocidade é exibida como estado estrutural de teste, sem ranking ou afinidade."><section className="empty-state" aria-labelledby="reciprocity-status"><h2 id="reciprocity-status">Nenhuma relação recíproca de teste ativa</h2><p className="muted">Convites, consentimentos e previsões recíprocas aparecem no painel do Radar quando autorizados.</p><a className="button" href="/radar">Voltar ao Radar</a></section></FoundationPage>;
}
