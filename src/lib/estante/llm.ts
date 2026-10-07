type Env = Record<string, string | undefined>;
export type Mensagem = { role: "user" | "assistant"; content: string | unknown[] };

/**
 * Chamada simples à API de mensagens da Anthropic, usada pela moderação e pela ilustração.
 * Devolve o texto da resposta, ou null se não foi possível (sem chave, rede, erro ou limite de uso),
 * depois de tentar de novo conforme pedido. Nunca lança.
 */
export async function chamarClaude(o: {
  env: Env; buscar: typeof fetch; modelo: string; sistema: string; mensagens: Mensagem[];
  maxTokens: number; temperatura: number; tentativas: number; timeoutMs: number;
}): Promise<string | null> {
  const chave = o.env.ANTHROPIC_API_KEY;
  if (!chave) return null;
  for (let tentativa = 0; tentativa < o.tentativas; tentativa++) {
    if (tentativa > 0) await new Promise((r) => setTimeout(r, 300));
    const limite = new AbortController();
    const timer = setTimeout(() => limite.abort(), o.timeoutMs);
    try {
      const r = await o.buscar("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": chave, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: o.modelo, max_tokens: o.maxTokens, temperature: o.temperatura, system: o.sistema, messages: o.mensagens }),
        signal: limite.signal,
      });
      if (!r.ok) {
        // O motivo da recusa (saldo, chave, limite de uso) vai para o log, sem nenhum conteúdo da pessoa. Antes sumia em silêncio.
        const corpoErro = (await r.json().catch(() => null)) as { error?: { type?: string; message?: string } } | null;
        console.warn(JSON.stringify({ level: "warn", event: "anthropic_recusou", status: r.status, tipo: corpoErro?.error?.type ?? null, mensagem: (corpoErro?.error?.message ?? "").slice(0, 140) }));
        continue;
      }
      const corpo = (await r.json()) as { content?: { type: string; text?: string }[] };
      const texto = (corpo.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
      if (texto) return texto;
    } catch (e) {
      console.warn(JSON.stringify({ level: "warn", event: "anthropic_sem_resposta", erro: (e as Error).name }));
    } finally { clearTimeout(timer); }
  }
  return null;
}
