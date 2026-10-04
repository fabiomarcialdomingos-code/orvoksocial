"use client";
import { useEffect, useState } from "react";
import { LOGIN_GOOGLE, Icone, Moldura, enviarJson, estilos as s } from "./pecas";

type Tentativa = { em: string };
type Dados = { logado: boolean; desafios: { codigo: string; criadoEm: string; tentativas: Tentativa[] }[] };

/** Convites do aparelho. Ao entrar logado, vincula à conta o que foi feito sem cadastro. */
export function MeusDesafios() {
  const [d, setD] = useState<Dados | null>(null);
  const [confirmar, setConfirmar] = useState<string | null>(null);
  const cancelar = async (codigo: string) => {
    const r = await enviarJson(`/api/v1/desafio/${codigo}/cancelar`, {});
    if (r.ok && d) setD({ ...d, desafios: d.desafios.filter((c) => c.codigo !== codigo) });
    setConfirmar(null);
  };
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
        <h1 className={s.titulo}>Meus <b>convites</b></h1>
        {d.desafios.length === 0 ? (
          <><p className={s.lead}>Você ainda não convidou ninguém neste aparelho.</p>
            <div className={s.empurra}><a className={`${s.btn} ${s.btnAzul}`} href="/comecar">Criar o meu retrato</a></div></>
        ) : (
          <div className={s.lista}>
            {d.desafios.map((c) => (
              <article key={c.codigo} className={s.item}>
                <b>Convite {c.codigo}</b>
                <p className={s.miudo}><Icone nome="relogio" />{c.tentativas.length === 0 ? "Ninguém respondeu ainda." : `${c.tentativas.length} ${c.tentativas.length === 1 ? "pessoa compartilhou" : "pessoas compartilharam"} como te veem, sem identificação.`}</p>
                {confirmar === c.codigo ? (
                  <div className={s.linhaBtn}>
                    <button className={`${s.btn} ${s.btnFio}`} type="button" onClick={() => void cancelar(c.codigo)}>Sim, cancelar</button>
                    <button className={`${s.btn} ${s.btnTexto}`} type="button" onClick={() => setConfirmar(null)}>Manter</button>
                  </div>
                ) : (
                  <button className={`${s.btn} ${s.btnTexto}`} type="button" onClick={() => setConfirmar(c.codigo)}>Cancelar este convite</button>
                )}
              </article>
            ))}
          </div>
        )}
        {!d.logado && d.desafios.length > 0 ? (
          <section className={s.oferta} style={{ marginTop: 16 }}>
            <h2>Crie sua conta para ver o seu retrato</h2>
            <p>Tudo o que você fez neste aparelho passa para a sua conta.</p>
            <a className={`${s.btn} ${s.btnClaro}`} href={LOGIN_GOOGLE}>Continuar com Google</a>
            <a className={`${s.btn} ${s.btnFio}`} href="/cadastro?returnTo=%2Fretrato"><Icone nome="email" />Continuar com e-mail</a>
          </section>
        ) : null}
      </main>
    </Moldura>
  );
}
