import { FoundationPage } from "../../components/FoundationPage";

export default function AuditPage() {
  return <FoundationPage eyebrow="Auditoria · TEST_ONLY" title="Trilha de auditoria" description="A consulta pública de auditoria não expõe dados. A visualização administrativa exige autorização e motivo."><section className="empty-state" aria-labelledby="audit-status"><h2 id="audit-status">Acesso restrito</h2><p className="muted">Use o Command Center com uma conta administrativa de teste para consultar eventos autorizados.</p><a className="button" href="/admin">Abrir Command Center</a></section></FoundationPage>;
}
