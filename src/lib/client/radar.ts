"use client";

import { useCallback, useEffect, useState } from "react";
import {
  apiGet, getAll, latestAnswers, loadPeople,
  type Answer, type Consent, type Dashboard, type Invitation, type Opportunity, type Profile, type Question,
} from "./api";

export type RadarState = {
  loading: boolean;
  error: string | null;
  questions: Question[];
  answers: Map<string, Answer>;
  consents: Consent[];
  selfGrant: Consent | null;
  invitations: Invitation[];
  opportunities: Opportunity[];
  dashboard: Dashboard | null;
  people: Map<string, Profile>;
  reload: () => Promise<void>;
  setAnswer: (answer: Answer) => void;
};

/** Everything the Radar screens need, loaded in parallel from the real API. */
export function useRadar(userId: string | undefined): RadarState {
  const [state, setState] = useState<Omit<RadarState, "reload">>({
    loading: true, error: null, questions: [], answers: new Map(), consents: [], selfGrant: null,
    invitations: [], opportunities: [], dashboard: null, people: new Map(),
  });

  const reload = useCallback(async () => {
    if (!userId) return;
    try {
      const [questions, answers, consents, invitations, opportunities, dashboard] = await Promise.all([
        getAll<Question>("/radar/questions"),
        getAll<Answer>("/radar/answers"),
        getAll<Consent>("/radar/consents"),
        getAll<Invitation>("/radar/invitations"),
        getAll<Opportunity>("/radar/opportunities"),
        apiGet<Dashboard>("/radar/dashboard"),
      ]);
      const ids = new Set<string>();
      for (const inv of invitations) { ids.add(inv.predictorId); ids.add(inv.targetId); }
      for (const o of opportunities) ids.add(o.targetId);
      for (const m of dashboard.matches) ids.add(m.userId);
      ids.delete(userId);
      const people = await loadPeople([...ids]);
      const selfGrant = consents
        .filter((c) => c.purpose === "SELF_ANSWER" && !c.revokedAt)
        .sort((a, b) => b.grantedAt.localeCompare(a.grantedAt))[0] ?? null;
      questions.sort((a, b) => a.text.localeCompare(b.text, "pt-BR"));
      for (const q of questions) q.options.sort((a, b) => a.position - b.position);
      setState({
        loading: false, error: null, questions, answers: latestAnswers(answers), consents, selfGrant,
        invitations, opportunities, dashboard, people: new Map(people),
      });
    } catch (error) {
      setState((s) => ({ ...s, loading: false, error: error instanceof Error ? error.message : "Falha ao carregar o Radar." }));
    }
  }, [userId]);

  useEffect(() => { void reload(); }, [reload]);

  // Applies a just-saved answer locally instead of refetching every Radar
  // list (questions, consents, invitations, opportunities, dashboard) after
  // every single click, which made answering feel slow.
  const setAnswer = useCallback((answer: Answer) => {
    setState((s) => {
      const next = new Map(s.answers);
      next.set(answer.questionVersionId, answer);
      return { ...s, answers: next };
    });
  }, []);

  return { ...state, reload, setAnswer };
}

/** Stable pseudo-angle for a person, so they keep their place on the instrument. */
export function angleFor(id: string, offset = 0): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return ((h % 360) + offset) % 360 - 180;
}
