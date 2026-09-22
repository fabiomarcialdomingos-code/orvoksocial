import { RadarWorkspace } from "../../components/RadarWorkspace";
import { SiteHeader } from "../../components/SiteHeader";

export default function RadarPage() {
  return (
    <>
      <SiteHeader />
      <main id="conteudo" className="container radar-main">
        <header className="radar-intro">
          <span className="eyebrow">Radar Humano · TEST_ONLY</span>
          <h1 className="display">Perspectivas entre pessoas.</h1>
          <p className="muted">Ambiente de teste com perguntas fictícias. A publicação do catálogo oficial e o uso com pessoas reais continuam bloqueados.</p>
        </header>
        <RadarWorkspace />
      </main>
    </>
  );
}
