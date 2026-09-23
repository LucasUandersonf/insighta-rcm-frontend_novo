import { useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CheckCircle2, ShieldAlert, Star } from "lucide-react";
import { getSatisfactionStatus, submitSatisfactionScore, ApiError } from "@/lib/api-client";
import { AuthLayout, AuthFormHeader } from "@/components/layout/AuthLayout";

/**
 * "Mapa de Dados Insighta" — Domínio Pós-atendimento (Onda 2), pilar
 * Satisfação/NPS: página PÚBLICA (sem autenticação) que o paciente abre
 * a partir do link que a recepção gera e envia manualmente (ver DECISÃO
 * completa em 052_appointment_satisfaction.sql, backend, sobre por que
 * não é uma mensagem automática de WhatsApp). Mesmo tratamento visual
 * "Aura Glass" das outras telas públicas (login/reset de senha).
 */
export function SatisfactionRatingPage() {
  const { token } = useParams<{ token: string }>();
  const [score, setScore] = useState(0);
  const [hoverScore, setHoverScore] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { data: status, isLoading } = useQuery({
    queryKey: ["public-satisfaction-status", token],
    queryFn: () => getSatisfactionStatus(token!),
    enabled: !!token,
    retry: false,
  });

  const mutation = useMutation({
    mutationFn: () => submitSatisfactionScore(token!, score),
    onError: (err) => setSubmitError(err instanceof ApiError ? err.message : "Não foi possível enviar sua avaliação. Tente novamente."),
  });

  if (!token || (!isLoading && !status?.valid)) {
    return (
      <AuthLayout headline="Avalie seu atendimento" subheadline="Sua opinião ajuda a clínica a melhorar o atendimento de todo mundo.">
        <div className="w-full max-w-sm rounded-xl border border-denied/25 bg-denied-bg p-6 text-center shadow-elevated backdrop-blur-xl">
          <span className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-canvas-surface/70 text-denied">
            <ShieldAlert size={20} strokeWidth={2} />
          </span>
          <h1 className="text-lg font-semibold text-ink">Link inválido</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            Este link de avaliação já foi usado, expirou, ou não é válido. Se você ainda quiser avaliar seu
            atendimento, entre em contato diretamente com a clínica.
          </p>
        </div>
      </AuthLayout>
    );
  }

  if (isLoading) {
    return (
      <AuthLayout headline="Avalie seu atendimento" subheadline="Sua opinião ajuda a clínica a melhorar o atendimento de todo mundo.">
        <div className="w-full max-w-sm rounded-xl border border-border-hairline bg-glass p-6 text-center shadow-elevated backdrop-blur-xl">
          <p className="text-sm text-ink-muted">Carregando...</p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout headline="Avalie seu atendimento" subheadline="Sua opinião ajuda a clínica a melhorar o atendimento de todo mundo.">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="w-full max-w-sm">
        {mutation.isSuccess ? (
          <div className="rounded-xl border border-revenue/25 bg-revenue-bg p-6 text-center shadow-elevated backdrop-blur-xl">
            <span className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-canvas-surface/70 text-revenue">
              <CheckCircle2 size={20} strokeWidth={2} />
            </span>
            <h1 className="text-lg font-semibold text-ink">Obrigado pela avaliação!</h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">Sua nota foi enviada com sucesso.</p>
          </div>
        ) : (
          <>
            <AuthFormHeader title="Como foi sua consulta?" subtitle="Toque nas estrelas para dar sua nota, de 1 a 5" />

            <div className="rounded-xl border border-border-hairline bg-glass p-6 shadow-elevated backdrop-blur-xl">
              <div className="mb-6 flex justify-center gap-2" role="radiogroup" aria-label="Nota de 1 a 5 estrelas">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={score === value}
                    aria-label={`${value} ${value === 1 ? "estrela" : "estrelas"}`}
                    onClick={() => setScore(value)}
                    onMouseEnter={() => setHoverScore(value)}
                    onMouseLeave={() => setHoverScore(0)}
                    className="p-1 transition-transform hover:scale-110"
                  >
                    <Star
                      size={32}
                      strokeWidth={1.5}
                      className={(hoverScore || score) >= value ? "fill-pending text-pending" : "text-ink-faint"}
                    />
                  </button>
                ))}
              </div>

              {submitError && (
                <div role="alert" className="mb-4 rounded-md border border-denied/25 bg-denied-bg px-3 py-2 text-xs text-denied">
                  {submitError}
                </div>
              )}

              <button
                type="button"
                disabled={score === 0 || mutation.isPending}
                onClick={() => {
                  setSubmitError(null);
                  mutation.mutate();
                }}
                className="flex w-full items-center justify-center gap-1.5 rounded-[11px] bg-brand px-3 py-2.5 text-sm font-medium text-white transition-all duration-150 hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {mutation.isPending ? "Enviando..." : "Enviar avaliação"}
              </button>
            </div>
          </>
        )}
      </motion.div>
    </AuthLayout>
  );
}
