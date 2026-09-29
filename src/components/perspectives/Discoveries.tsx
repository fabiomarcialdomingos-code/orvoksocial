"use client";
import Link from "next/link";
import { useState } from "react";
import {
  assess,
  RELATIONS,
  TOPICS,
  type Connection,
} from "../../lib/perspectives/model";
import {
  PageHead,
  useResource,
  Loading,
  ErrorState,
  Avatar,
  ConnectionCard,
} from "./Shared";
export function Discoveries() {
  const r = useResource<{ items: Connection[] }>("/perspectives/connections");
  const [who, setWho] = useState("all");
  const personal = (r.data?.items ?? []).filter(
    (c) => c.isOwner && c.kind === "people" && c.state === "completed",
  );
  const people = [
    ...new Map(
      personal
        .filter((c) => c.guestId)
        .map((c) => [c.guestId!, c.guestName ?? "Pessoa"]),
    ).entries(),
  ];
  const seen = new Set<string>();
  const rows = personal
    .filter((c) => who === "all" || c.guestId === who)
    .flatMap((c) =>
      assess(c.questions ?? [], c.answers ?? {}, c.guesses ?? {}).rows.flatMap(
        (row) => {
          const key = `${c.guestId}:${row.question.id}:${row.question.version}`;
          if (row.previouslyRevealed || seen.has(key)) return [];
          seen.add(key);
          return [{ ...row, connection: c }];
        },
      ),
    );
  if (r.error)
    return <ErrorState message={r.error} retry={() => void r.reload()} />;
  if (!r.data) return <Loading />;
  return (
    <>
      <PageHead
        kicker="03 / Descobertas"
        title="Existe mais de um jeito de ver você."
        text="O que esperam de você, onde te entendem e onde você surpreende. Cada leitura vem de respostas reais."
      />
      <div className="filter-bar">
        <button
          className="chip"
          aria-pressed={who === "all"}
          onClick={() => setWho("all")}
        >
          Todas as perspectivas
        </button>
        {people.map(([id, name]) => (
          <button
            className="chip"
            key={id}
            aria-pressed={who === id}
            onClick={() => setWho(id)}
          >
            {name}
          </button>
        ))}
      </div>
      {!rows.length ? (
        <div className="empty illustrated-empty">
          <span className="empty-mark">↔</span>
          <h2>O seu olhar é só o começo.</h2>
          <p>
            Quando alguém concluir uma rodada sobre você, as comparações
            aparecem aqui. Tudo fica privado.
          </p>
          <Link href="/sobre-mim" className="button">
            Convidar para me conhecer ↗
          </Link>
        </div>
      ) : (
        <>
          <div className="discovery-summary">
            <article>
              <span>Perspectivas recebidas</span>
              <strong>{rows.length}</strong>
              <p>Comparações distintas entre pessoa e pergunta.</p>
            </article>
            <article>
              <span>Onde te entendem</span>
              <strong>{rows.filter((r) => r.hit).length}</strong>
              <p>Escolhas que alguém antecipou.</p>
            </article>
            <article>
              <span>Onde você surpreende</span>
              <strong>{rows.filter((r) => !r.hit).length}</strong>
              <p>Escolhas diferentes da expectativa.</p>
            </article>
          </div>
          <p className="evidence-note">
            Rodadas podem ter perguntas diferentes. Estes números descrevem sua
            experiência; não classificam quem conhece você melhor.
          </p>
          <section className="section-space">
            <div className="section-title">
              <h2>O que esperavam de você</h2>
              <span>Da expectativa à sua escolha</span>
            </div>
            <div className="expectation-list">
              {rows.map((row) => (
                <article key={`${row.connection.id}:${row.question.id}`}>
                  <div className="expectation-person">
                    <Avatar name={row.connection.guestName} />
                    <div>
                      <strong>{row.connection.guestName}</strong>
                      <small>
                        {RELATIONS[row.connection.relationship ?? "geral"]} ·{" "}
                        {TOPICS[row.question.topic as keyof typeof TOPICS]}
                      </small>
                    </div>
                    <span
                      className={`status ${row.hit ? "completed" : "accepted"}`}
                    >
                      {row.hit ? "Entendeu" : "Surpreendeu"}
                    </span>
                  </div>
                  <h3>{row.question.text}</h3>
                  <div className="expectation-comparison">
                    <p>
                      <span>A pessoa esperava</span>
                      {
                        row.question.options.find((o) => o.id === row.guess)
                          ?.label
                      }
                    </p>
                    <b>→</b>
                    <p>
                      <span>Você escolheu</span>
                      {
                        row.question.options.find((o) => o.id === row.answer)
                          ?.label
                      }
                    </p>
                  </div>
                  <Link
                    href={`/juntos/${row.connection.code}`}
                    className="text-link"
                  >
                    Conversar sobre isso ↗
                  </Link>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
      <section className="section-space">
        <div className="section-title">
          <h2>O mundo entre vocês</h2>
          <Link className="text-link" href="/mundo">
            Escolher um evento ↗
          </Link>
        </div>
        <p>
          Entender a previsão de alguém, pensar parecido e acertar o evento são
          descobertas diferentes.
        </p>
        <div className="connection-grid">
          {r.data.items
            .filter((c) => c.kind === "world" && c.state === "completed")
            .map((c) => (
              <ConnectionCard connection={c} key={c.id} />
            ))}
        </div>
      </section>
    </>
  );
}
