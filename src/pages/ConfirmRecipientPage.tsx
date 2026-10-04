import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, MailCheck, ShieldAlert } from "lucide-react";
import { ApiError, apiClient } from "@/lib/api-client";
import { AuthFormHeader, AuthLayout } from "@/components/layout/AuthLayout";

const HIGHLIGHTS = [
  { icon: MailCheck, text: "Sem a sua confirmação nenhum relatório é enviado para este e-mail." },
];

/**
 * Auditoria V1, rodada 8 (A2): link que a pessoa cadastrada como
 * destinatária de relatório recebe. Abre sem login; só depois disso a
 * clínica consegue enviar relatórios para o endereço.
 */
export function ConfirmRecipientPage() {
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get("token") ?? "", [searchParams]);
  const [state, setState] = useState<"loading" | "ok" | "error">(token ? "loading" : "error");
  const [message, setMessage] = useState(token ? "" : "Link incompleto. Abra o link do e-mail de novo.");
  const sent = useRef(false);

  useEffect(() => {
    if (!token || sent.current) return;
    sent.current = true; // StrictMode monta duas vezes: o token é de uso único
    apiClient
      .post<void>("/api/v1/report-recipients/confirm-email", { token }, { skipAuth: true })
      .then(() => setState("ok"))
      .catch((err) => {
        setState("error");
        setMessage(err instanceof ApiError ? err.message : "Não foi possível confirmar agora. Tente de novo em instantes.");
      });
  }, [token]);

  return (
    <AuthLayout eyebrow="Inteligência para clínicas" headline="Relatórios por e-mail" subheadline="" highlights={HIGHLIGHTS}>
      <div className="w-full max-w-md">
        <AuthFormHeader title="Confirmar recebimento de relatórios" subtitle="" />
        <div className="rounded-xl border border-border-hairline bg-glass p-6 shadow-elevated backdrop-blur-xl" role="status" aria-live="polite">
          {state === "loading" && <p className="text-sm text-ink-muted">Confirmando…</p>}
          {state === "ok" && (
            <div className="space-y-3">
              <p className="flex items-center gap-2 text-sm font-medium text-ink">
                <CheckCircle2 className="h-4 w-4 text-revenue" aria-hidden /> E-mail confirmado.
              </p>
              <p className="text-sm text-ink-muted">
                Pronto. Você vai receber os relatórios que a clínica escolheu. Para parar, peça à clínica para remover o seu
                contato.
              </p>
            </div>
          )}
          {state === "error" && (
            <div className="space-y-3">
              <p className="flex items-center gap-2 text-sm font-medium text-ink">
                <ShieldAlert className="h-4 w-4 text-denied" aria-hidden /> Não foi possível confirmar.
              </p>
              <p className="text-sm text-ink-muted">{message}</p>
            </div>
          )}
        </div>
      </div>
    </AuthLayout>
  );
}
