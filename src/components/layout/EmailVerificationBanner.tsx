import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { MailWarning } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { useCurrentUserProfile } from "@/lib/useCurrentUserProfile";

/** Aviso fixo enquanto o e-mail do cadastro não foi confirmado: sem
 * confirmação, a assinatura fica bloqueada e a nota fiscal não chega. */
export function EmailVerificationBanner() {
  const { data: profile } = useCurrentUserProfile();
  const [feedback, setFeedback] = useState<string | null>(null);
  const resend = useMutation({
    mutationFn: () => apiClient.post<{ status: string; email?: string }>("/api/v1/auth/verify-email/resend"),
    onSuccess: (data) =>
      setFeedback(data.status === "ja_confirmado" ? "Seu e-mail já está confirmado." : `Enviamos um novo link para ${data.email}.`),
    onError: (err) => setFeedback(getApiErrorMessage(err)),
  });

  if (!profile || profile.email_verified_at !== null) return null; // undefined = API antiga; confirmado = some

  return (
    <div className="border-b border-pending/30 bg-pending/10" role="status">
      <div className="mx-auto flex w-full max-w-[1680px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 text-sm sm:px-8">
        <MailWarning className="h-4 w-4 shrink-0 text-pending" aria-hidden />
        <p className="min-w-0 flex-1 text-ink">
          Confirme seu e-mail <strong className="font-semibold">{profile.email}</strong> pelo link que enviamos. Sem isso não dá para
          assinar.
        </p>
        {feedback ? (
          <span className="text-ink-muted">{feedback}</span>
        ) : (
          <button
            type="button"
            className="font-medium text-accent underline disabled:opacity-60"
            onClick={() => resend.mutate()}
            disabled={resend.isPending}
          >
            {resend.isPending ? "Enviando…" : "Reenviar confirmação"}
          </button>
        )}
      </div>
    </div>
  );
}
