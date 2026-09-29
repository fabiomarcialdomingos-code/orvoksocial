"use client";
import { useEffect, useState } from "react";
import { LOGIN_GOOGLE, Icone, Moldura, enviarJson, estilos as s } from "./pecas";

type Tentativa = { nome: string | null; em: string; score?: number; total?: number };
type Dados = { logado: boolean; desafios: { codigo: string; criadoEm: string; tentativas: Tentativa[] }[] };

/** Resultado dos desafios. Ao entrar logado, vincula à conta o que foi feito sem cadastro. */
export function MeusDesafios() {
  const [d, setD] = useState<Dados | null>(null);
  useEffect(() => {
    void (async () => {
      await enviarJson("/api/v1/desafio/reivindicar", {}).catch(() => undefined);
      const r = await fetch("/api/v1/desafio/meus", { credentials: "same-origin" });
      setD(r.ok ? ((await r.json()) as Dados) : { logado: false, desafios: [] });
    })();
  }, []);
  if (!d) return <Moldura><main className={s.tela} aria-busy="true" /></Moldura>;
  return (
    <Moldura>
      <main className={s.tela}>
        <h1 className={s.titulo}>Meus <b>desafios</b></h1>
        {d.desafios.length === 0 ? (
          <><p className={s.lead}>Você ainda não desafiou ninguém neste aparelho.</p>
            <div className={s.empurra}><a className={`${s.btn} ${s.btnAzul}`} href="/comecar">Criar meu desafio</a></div></>
        ) : (
          <div className={s.lista}>
            {d.desafios.map((c) => (
              <article key={c.codigo} className={s.item}>
                <b>Desafio {c.codigo}</b>
                {c.tentativas.length === 0 ? <p className={s.miudo}><Icone nome="relogio" />Ninguém respondeu ainda.</p> : c.tentativas.map((t) => (
                  <div key={t.em} className={s.tent}>
                    <span>{t.nome ?? "Alguém"} respondeu</span>
                    {d.logado && t.score !== undefined ? <strong>{t.score} de {t.total}</strong> : <span className={s.miudo}>placar com a conta</span>}
                  </div>
                ))}
              </article>
            ))}
          </div>
        )}
        {!d.logado && d.desafios.length > 0 ? (
          <section className={s.oferta} style={{ marginTop: 16 }}>
            <h2>Crie sua conta para ver os placares</h2>
            <p>Tudo o que você fez neste aparelho passa para a sua conta.</p>
            <a className={`${s.btn} ${s.btnClaro}`} href={LOGIN_GOOGLE}>Continuar com Google</a>
            <a className={`${s.btn} ${s.btnFio}`} href="/cadastro?returnTo=%2Fdesafios"><Icone nome="email" />Continuar com e-mail</a>
          </section>
        ) : null}
      </main>
    </Moldura>
  );
}
