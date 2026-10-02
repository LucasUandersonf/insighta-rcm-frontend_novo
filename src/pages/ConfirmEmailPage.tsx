import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, MailCheck, ShieldAlert } from "lucide-react";
import { ApiError, apiClient } from "@/lib/api-client";
import { AuthFormHeader, AuthLayout } from "@/components/layout/AuthLayout";

const HIGHLIGHTS = [{ icon: MailCheck, text: "O e-mail confirmado recebe a nota fiscal, os avisos de cobrança e o link para trocar a senha." }];

/** Link do e-mail de confirmação: /confirmar-email?token=... (sem login). */
export function ConfirmEmailPage() {
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get("token") ?? "", [searchParams]);
  const [state, setState] = useState<"loading" | "ok" | "error">(token ? "loading" : "error");
  const [message, setMessage] = useState(token ? "" : "Link incompleto. Abra o link do e-mail de novo.");
  const sent = useRef(false);

  useEffect(() => {
    if (!token || sent.current) return;
    sent.current = true; // StrictMode monta duas vezes: o token é de uso único
    apiClient
      .post<void>("/api/v1/auth/verify-email", { token }, { skipAuth: true })
      .then(() => setState("ok"))
      .catch((err) => {
        setState("error");
        setMessage(err instanceof ApiError ? err.message : "Não foi possível confirmar agora. Tente de novo em instantes.");
      });
  }, [token]);

  return (
    <AuthLayout eyebrow="Inteligência para clínicas" headline="Confirmação de e-mail" subheadline="" highlights={HIGHLIGHTS}>
      <div className="w-full max-w-md">
        <AuthFormHeader title="Confirmar e-mail" subtitle="" />
        <div className="rounded-xl border border-border-hairline bg-glass p-6 shadow-elevated backdrop-blur-xl" role="status" aria-live="polite">
          {state === "loading" && <p className="text-sm text-ink-muted">Confirmando o seu e-mail…</p>}
          {state === "ok" && (
            <div className="space-y-3">
              <p className="flex items-center gap-2 text-sm font-medium text-ink">
                <CheckCircle2 className="h-4 w-4 text-revenue" aria-hidden /> E-mail confirmado.
              </p>
              <p className="text-sm text-ink-muted">Pronto. Você já pode assinar e receber os avisos da Insighta neste e-mail.</p>
              <Link to="/" className="text-sm font-medium text-accent underline">
                Ir para o Insighta
              </Link>
            </div>
          )}
          {state === "error" && (
            <div className="space-y-3">
              <p className="flex items-center gap-2 text-sm font-medium text-ink">
                <ShieldAlert className="h-4 w-4 text-denied" aria-hidden /> Não foi possível confirmar.
              </p>
              <p className="text-sm text-ink-muted">{message}</p>
              <Link to="/" className="text-sm font-medium text-accent underline">
                Entrar e pedir um novo link
              </Link>
            </div>
          )}
        </div>
      </div>
    </AuthLayout>
  );
}
