import type { Metadata } from "next";
import { SiteNav } from "../../../components/site/SiteNav";
import { AcceptChallenge } from "../../../components/site/AcceptChallenge";
import { Instrument } from "../../../components/ui/Instrument";
import { getSharePreview } from "../../../lib/share";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const preview = await getSharePreview(code).catch(() => null);
  const name = preview?.displayName ?? "Alguém";
  const title = `Quanto você conhece ${name.split(" ")[0]}?`;
  const description = preview?.teaser ? `${name} te desafiou no ORVOK. Uma das perguntas: ${preview.teaser}` : `${name} te desafiou a prever as respostas dele no ORVOK.`;
  return { title, description, openGraph: { title, description, type: "website", siteName: "ORVOK" }, twitter: { card: "summary_large_image", title, description } };
}

export default async function SharePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const preview = await getSharePreview(code).catch(() => null);
  const name = preview?.displayName ?? "";
  const first = name.split(" ")[0] ?? name;
  return (
    <>
      <SiteNav />
      <main id="conteudo" className="container hero share-landing">
        <div>
          {preview?.active ? (
            <>
              <span className="eyebrow">{name} te convidou</span>
              <h1 className="display">Quanto você conhece {first}?</h1>
              <p className="lede">
                {first} respondeu doze perguntas sobre si. O desafio é antecipar o que foi respondido. {first} só vê as suas previsões se consentir, e você nunca vê as respostas de {first}.
              </p>
              {preview.teaser && (
                <blockquote className="share-teaser" data-p="people">
                  <span>Uma das perguntas</span>
                  {preview.teaser}
                </blockquote>
              )}
              {preview.message && <p className="share-message">“{preview.message}”</p>}
              <AcceptChallenge code={code} name={first} />
            </>
          ) : (
            <>
              <h1 className="display">Este convite não está mais disponível.</h1>
              <p className="lede">Ele pode ter expirado, atingido o limite de pessoas ou sido encerrado por quem criou. Peça um novo link.</p>
            </>
          )}
        </div>
        <div className="hero-instrument">
          <Instrument label={`Radar de ${first || "convite"}`} nodes={[
            { id: "owner", label: first || undefined, p: "self", r: 0, angle: 0, size: 9 },
            { id: "you", label: "você?", p: "people", r: 0.46, angle: -30, size: 8, linked: true },
            { id: "a", p: "people", r: 0.62, angle: 120, size: 5 },
            { id: "b", p: "people", r: 0.74, angle: 210, size: 4 },
            { id: "w", p: "world", r: 0.9, angle: 60, size: 4 },
          ]} />
        </div>
      </main>
    </>
  );
}
