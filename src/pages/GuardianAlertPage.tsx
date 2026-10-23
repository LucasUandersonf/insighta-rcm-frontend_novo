import { useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, ShieldAlert, Siren } from "lucide-react";
import { ApiError, actOnGuardianAlert, getGuardianAlert, type GuardianActionResult } from "@/lib/api-client";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/Button";
import { brlWhole } from "@/lib/team";

type Action = "resolver" | "delegar" | "ignorar";

const ACTION_COPY: Record<Action, { label: string; help: string }> = {
  resolver: { label: "Já resolvi / vou resolver", help: "Entra em Meus insights como resolvido e o ganho é medido depois." },
  delegar: { label: "Delegar para alguém", help: "A pessoa escolhida recebe a tarefa em Meus insights." },
  ignorar: { label: "Ignorar este alerta", help: "Fica registrado que a clínica decidiu não agir agora." },
};

const ROLE_LABEL: Record<string, string> = {
  owner: "Dono",
  admin: "Administrador",
  financeiro: "Financeiro",
  atendimento: "Atendimento",
};

/**
 * Guardian: página PÚBLICA (sem login) que abre pelo link do alerta enviado
 * por e-mail ou WhatsApp. Quem recebe decide ali mesmo, e a decisão entra no
 * ciclo resolvido → reavaliado de Meus insights. O link vale 72 horas e
 * registra uma decisão só.
 */
export function GuardianAlertPage() {
  const { token } = useParams<{ token: string }>();
  const [params] = useSearchParams();
  const initial = params.get("acao");
  const [action, setAction] = useState<Action | null>(
    initial === "resolver" || initial === "delegar" || initial === "ignorar" ? initial : null,
  );
  const [assignee, setAssignee] = useState("");
  const [note, setNote] = useState("");
  const [result, setResult] = useState<GuardianActionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: alert, isLoading, error: loadError } = useQuery({
    queryKey: ["guardian-alert", token],
    queryFn: () => getGuardianAlert(token!),
    enabled: !!token,
    retry: false,
  });

  const mutation = useMutation({
    mutationFn: () =>
      actOnGuardianAlert(token!, {
        action: action!,
        assigned_to: action === "delegar" ? assignee : null,
        note: note.trim() || null,
      }),
    onSuccess: setResult,
    onError: (err) => setError(err instanceof ApiError ? err.message : "Não foi possível registrar a decisão. Tente de novo."),
  });

  const layout = (children: React.ReactNode) => (
    <AuthLayout headline="Insighta Guardian" subheadline="Dinheiro em risco, com a decisão em um clique.">
      <div className="w-full max-w-md rounded-xl border border-border-hairline bg-glass p-6 shadow-elevated backdrop-blur-xl">{children}</div>
    </AuthLayout>
  );

  if (isLoading) return layout(<p className="text-center text-sm text-ink-muted">Carregando o alerta…</p>);

  if (!token || loadError || !alert) {
    return layout(
      <div className="text-center">
        <ShieldAlert aria-hidden className="mx-auto mb-3 text-denied" size={24} />
        <h1 className="text-lg font-semibold text-ink">Link inválido ou expirado</h1>
        <p className="mt-2 text-sm text-ink-muted">
          {loadError instanceof ApiError ? loadError.message : "Abra o Insighta para ver as prioridades do dia."}
        </p>
      </div>,
    );
  }

  if (result || alert.action) {
    const label = result?.action_label ?? alert.action_label;
    return layout(
      <div className="text-center">
        <CheckCircle2 aria-hidden className="mx-auto mb-3 text-revenue" size={26} />
        <h1 className="text-lg font-semibold text-ink">Decisão registrada: {label?.toLowerCase()}</h1>
        <p className="mt-2 text-sm text-ink-muted">
          {result
            ? "Está em Meus insights. Quando o resultado for conferido, ele aparece no Extrato de Resultado."
            : `Este alerta já foi decidido${alert.acted_by ? ` por ${alert.acted_by}` : ""}.`}
        </p>
        {alert.action_url && (
          <a className="mt-4 inline-block text-sm font-medium text-accent underline" href={alert.action_url}>
            Abrir no Insighta
          </a>
        )}
      </div>,
    );
  }

  const canSubmit = !!action && (action !== "delegar" || !!assignee) && !mutation.isPending;

  return layout(
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        mutation.mutate();
      }}
    >
      <div>
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-denied">
          <Siren aria-hidden size={14} /> Precisa de decisão
        </p>
        <h1 className="mt-2 text-lg font-semibold text-ink">{alert.title}</h1>
        {alert.financial_impact != null && (
          <p className="mt-1 text-2xl font-semibold tabular text-ink">{brlWhole(alert.financial_impact)} em jogo</p>
        )}
        <p className="mt-2 text-sm text-ink-muted">{alert.message}</p>
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-semibold text-ink">O que fazer?</legend>
        {(Object.keys(ACTION_COPY) as Action[]).map((key) => (
          <label
            key={key}
            className={
              "flex cursor-pointer flex-col rounded-lg border px-3 py-2 text-sm " +
              (action === key ? "border-accent bg-accent/5" : "border-border-default hover:bg-canvas-raised")
            }
          >
            <span className="flex items-center gap-2 font-medium text-ink">
              <input type="radio" name="acao" value={key} checked={action === key} onChange={() => setAction(key)} />
              {ACTION_COPY[key].label}
            </span>
            <span className="pl-6 text-xs text-ink-muted">{ACTION_COPY[key].help}</span>
          </label>
        ))}
      </fieldset>

      {action === "delegar" && (
        <label className="block text-sm text-ink">
          Para quem?
          <select
            className="mt-1 w-full rounded-md border border-border-default bg-canvas px-2 py-2 text-sm"
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            required
          >
            <option value="">Escolha uma pessoa da equipe</option>
            {alert.team.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({ROLE_LABEL[m.role] ?? m.role})
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="block text-sm text-ink">
        Observação (opcional)
        <textarea
          className="mt-1 w-full rounded-md border border-border-default bg-canvas px-2 py-2 text-sm"
          rows={2}
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>

      {error && <p className="text-sm text-denied" role="alert">{error}</p>}

      <Button type="submit" className="w-full" disabled={!canSubmit}>
        {mutation.isPending ? "Registrando…" : "Registrar decisão"}
      </Button>
    </form>,
  );
}
