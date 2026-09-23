"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Mode =
  "register" | "login" | "request-reset" | "reset-password" | "verify-email";
const config: Record<
  Mode,
  { title: string; path: string; action: string; success: string }
> = {
  register: {
    title: "Criar conta",
    path: "/register",
    action: "Criar conta",
    success: "Conta criada. Você já pode entrar com seu e-mail e senha.",
  },
  login: {
    title: "Entrar",
    path: "/login",
    action: "Entrar",
    success: "Você entrou na sua conta.",
  },
  "request-reset": {
    title: "Recuperar acesso",
    path: "/request-reset",
    action: "Solicitar recuperação",
    success:
      "Se esse e-mail estiver cadastrado, você receberá instruções de recuperação.",
  },
  "reset-password": {
    title: "Definir nova senha",
    path: "/reset-password",
    action: "Salvar nova senha",
    success: "Senha atualizada. Entre com sua nova senha.",
  },
  "verify-email": {
    title: "Verificar e-mail",
    path: "/verify-email",
    action: "Verificar e-mail",
    success: "E-mail verificado. Você já pode entrar.",
  },
};

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const tokenInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("oauth") === "error"
    ? { kind: "error", text: "Não foi possível concluir o login com Google. Tente novamente ou use sua senha." }
    : null);
  const needsEmail =
    mode === "register" || mode === "login" || mode === "request-reset";
  const needsPassword =
    mode === "register" || mode === "login" || mode === "reset-password";
  const needsToken = mode === "reset-password" || mode === "verify-email";
  useEffect(() => {
    if (!needsToken) return;
    const incoming = new URLSearchParams(window.location.hash.slice(1)).get("token") ??
      new URLSearchParams(window.location.search).get("token");
    if (incoming && /^[A-Za-z0-9_-]{43}$/.test(incoming) && tokenInputRef.current)
      tokenInputRef.current.value = incoming;
    if (incoming) window.history.replaceState(null, "", window.location.pathname);
  }, [needsToken]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    const fields = new FormData(event.currentTarget);
    const body: Record<string, string> = {};
    if (needsEmail) body.email = String(fields.get("email") ?? "").trim();
    if (needsPassword) body.password = String(fields.get("password") ?? "");
    if (needsToken) body.token = String(fields.get("token") ?? "").trim();
    try {
      const response = await fetch(`/api/v1/auth${config[mode].path}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        setMessage({
          kind: "error",
          text:
            response.status === 429
              ? "Muitas tentativas. Aguarde e tente novamente."
              : "Não foi possível concluir esta ação. Confira os dados e tente novamente.",
        });
        return;
      }
      setMessage({ kind: "success", text: config[mode].success });
      if (needsToken && tokenInputRef.current) tokenInputRef.current.value = "";
      if (mode === "login") router.push("/radar");
    } catch {
      setMessage({
        kind: "error",
        text: "Sem conexão. Verifique sua internet e tente novamente.",
      });
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <h2 className="display">{config[mode].title}</h2>
      <form onSubmit={submit} className="form-stack">
        {needsEmail && (
          <div className="field">
            <label htmlFor="auth-email">E-mail</label>
            <input
              id="auth-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
            />
          </div>
        )}
        {needsPassword && (
          <div className="field">
            <label htmlFor="auth-password">
              {mode === "reset-password" ? "Nova senha" : "Senha"}
            </label>
            <input
              id="auth-password"
              name="password"
              type="password"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
                minLength={mode === "login" ? undefined : 8}
                pattern={mode === "login" ? undefined : "(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}"}
                required
            />
            <span className="field-hint">
              {mode === "login" ? "" : "A senha deve conter no mínimo 8 caracteres, incluindo uma letra minúscula, uma letra maiúscula e um caractere especial."}
            </span>
          </div>
        )}
        {needsToken && (
          <div className="field">
            <label htmlFor="auth-token">Código recebido por e-mail</label>
            <input
              id="auth-token"
              name="token"
              type="text"
              autoComplete="one-time-code"
              ref={tokenInputRef}
              required
            />
          </div>
        )}
        {message && (
          <p
            className="form-message"
            data-kind={message.kind}
            role={message.kind === "error" ? "alert" : "status"}
          >
            {message.text}
          </p>
        )}
        <div className="form-actions">
          <button className="button" type="submit" disabled={pending}>
            {pending ? "Aguarde…" : config[mode].action}
          </button>
          {mode === "login" && (
            <Link className="text-link" href="/recuperar">
              Esqueci minha senha
            </Link>
          )}
          {mode !== "login" && (
            <Link className="text-link" href="/entrar">
              Ir para entrar
            </Link>
          )}
        </div>
      </form>
      {(mode === "login" || mode === "register") && (
        <div className="auth-provider-actions">
          <span className="muted">ou</span>
          <a className="button button-secondary" href={`/api/v1/auth/google/start?returnTo=${encodeURIComponent("/radar")}`} aria-label={mode === "login" ? "Continuar com Google" : "Cadastrar com Google"}>
            {mode === "login" ? "Continuar com Google" : "Cadastrar com Google"}
          </a>
        </div>
      )}
    </>
  );
}
