import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { MailWarning, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { useCurrentUserProfile } from "@/lib/useCurrentUserProfile";
import { useCapabilities } from "@/lib/capabilities";

/** Aviso fixo enquanto o e-mail do cadastro não foi confirmado: sem
 * confirmação, a assinatura fica bloqueada e a nota fiscal não chega. */
const DISMISS_KEY = "insighta_email_banner_dismissed";

function wasDismissed(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

export function EmailVerificationBanner() {
  const { data: profile } = useCurrentUserProfile();
  const { user } = useAuth();
  const { data: capabilities } = useCapabilities();
  const [feedback, setFeedback] = useState<string | null>(null);
  // Qualidade percebida: aviso fixo em toda tela era ruído; dá para
  // dispensar nesta sessão (volta no próximo acesso até confirmar).
  const [dismissed, setDismissed] = useState(wasDismissed);
  const resend = useMutation({
    mutationFn: () => apiClient.post<{ status: string; email?: string }>("/api/v1/auth/verify-email/resend"),
    onSuccess: (data) =>
      setFeedback(
        data.status === "ja_confirmado"
          ? "Seu e-mail já está confirmado."
          : data.status === "indisponivel"
            ? "O envio de e-mails ainda não está ativo. Fale com o suporte para confirmar."
            : `Enviamos um novo link para ${data.email}.`
      ),
    onError: (err) => setFeedback(getApiErrorMessage(err)),
  });

  if (!profile || profile.email_verified_at !== null || dismissed) return null; // undefined = API antiga; confirmado = some
  // UX3-06: sem e-mail ligado, nenhum link foi enviado e nada depende dele.
  if (capabilities?.email_enabled === false) return null;
  // UX-25: só o dono assina; para a equipe, "sem isso não dá para assinar" não se aplica.
  const isOwner = user?.role === "owner";

  return (
    <div className="border-b border-pending/30 bg-pending/10" role="status">
      <div className="mx-auto flex w-full max-w-[1680px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 text-sm sm:px-8">
        <MailWarning className="h-4 w-4 shrink-0 text-pending" aria-hidden />
        <p className="min-w-0 flex-1 text-ink">
          Confirme seu e-mail <strong className="font-semibold break-all">{profile.email}</strong>
          <span className="hidden sm:inline">
            {" "}pelo link que enviamos{isOwner && capabilities?.billing_enabled ? " — é ele que libera a assinatura e a nota fiscal" : ""}.
          </span>
        </p>
        {feedback ? (
          <span className="text-ink-muted">{feedback}</span>
        ) : (
          <button
            type="button"
            className="font-medium text-accent underline disabled:opacity-60 max-sm:min-h-[44px] max-sm:px-2"
            onClick={() => resend.mutate()}
            disabled={resend.isPending}
            aria-label="Reenviar confirmação"
          >
            {resend.isPending ? "Enviando…" : "Reenviar"}
          </button>
        )}
        <button
          type="button"
          aria-label="Dispensar aviso"
          className="flex items-center justify-center text-ink-faint hover:text-ink max-sm:h-11 max-sm:w-11"
          onClick={() => {
            try {
              sessionStorage.setItem(DISMISS_KEY, "1");
            } catch {
              /* sem storage: some só nesta tela */
            }
            setDismissed(true);
          }}
        >
          <X aria-hidden size={15} />
        </button>
      </div>
    </div>
  );
}
