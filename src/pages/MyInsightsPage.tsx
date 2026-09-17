import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ClipboardList, TrendingUp } from "lucide-react";
import { Panel, EmptyState, LoadingState, ErrorState } from "@/components/ui/Panel";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { SelectField, TextareaField } from "@/components/ui/FormField";
import { PageHeader } from "@/components/ui/PageHeader";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import type {
  InsightOutcome,
  InsightOutcomeStatus,
  InsightOutcomesRealizedSummary,
  InsightOutcomeUpdateRequest,
  PaginatedResponse,
} from "@/lib/types";

const STATUS_LABELS: Record<InsightOutcomeStatus, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  resolvido: "Resolvido",
  ignorado: "Ignorado",
};

const STATUS_TONE: Record<InsightOutcomeStatus, BadgeTone> = {
  pendente: "pending",
  em_andamento: "accent",
  resolvido: "revenue",
  ignorado: "neutral",
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));
}

/**
 * Épico F1.3: "Visão 'Meus pendentes' por usuário, além da fila geral
 * do gestor" — quem EXECUTA (recepção, faturista) atualiza o próprio
 * progresso aqui, em vez de precisar acesso à Sala de Comando inteira
 * (GET /insight-outcomes/mine é aberto a qualquer papel autenticado —
 * ver DECISÃO em app/api/v1/endpoints/insight_outcomes.py).
 */
function MyPendingSection() {
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["insight-outcomes", "mine"],
    queryFn: () => apiClient.get<PaginatedResponse<InsightOutcome>>("/api/v1/insight-outcomes/mine?limit=50"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: InsightOutcomeUpdateRequest }) =>
      apiClient.patch<InsightOutcome>(`/api/v1/insight-outcomes/${id}`, payload),
    onSuccess: () => {
      showSuccess("Atualizado.");
      queryClient.invalidateQueries({ queryKey: ["insight-outcomes", "mine"] });
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  const items = data?.items ?? [];
  const openItems = items.filter((i) => i.status === "pendente" || i.status === "em_andamento");

  return (
    <Panel title="Meus pendentes" subtitle="Insights atribuídos a você — atualize o progresso conforme for agindo.">
      {isLoading && <LoadingState variant="table" rows={3} />}
      {error && <ErrorState message={getApiErrorMessage(error)} onRetry={() => refetch()} />}
      {!isLoading && !error && openItems.length === 0 && (
        <EmptyState icon={<CheckCircle2 size={17} strokeWidth={1.5} />} message="Nada atribuído a você no momento." />
      )}
      {openItems.length > 0 && (
        <div className="divide-y divide-border-hairline">
          {openItems.map((outcome) => (
            <div key={outcome.id} className="space-y-3 px-5 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={STATUS_TONE[outcome.status]}>{STATUS_LABELS[outcome.status]}</Badge>
                {outcome.due_date && <span className="text-2xs text-ink-faint">Prazo: {formatDate(outcome.due_date)}</span>}
              </div>
              <h4 className="text-sm font-medium text-ink">{outcome.title}</h4>
              <p className="text-xs leading-relaxed text-ink-muted">{outcome.message}</p>
              <div className="flex flex-wrap items-end gap-3">
                <SelectField
                  label="Status"
                  value={outcome.status}
                  onChange={(e) =>
                    updateMutation.mutate({ id: outcome.id, payload: { status: e.target.value as InsightOutcomeStatus } })
                  }
                  className="max-w-[200px]"
                >
                  <option value="pendente">Pendente</option>
                  <option value="em_andamento">Em andamento</option>
                  <option value="resolvido">Resolvido</option>
                  <option value="ignorado">Ignorado</option>
                </SelectField>
              </div>
              <TextareaField
                label="Observação"
                rows={2}
                value={noteDrafts[outcome.id] ?? outcome.resolution_note ?? ""}
                onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [outcome.id]: e.target.value }))}
                onBlur={() => {
                  const note = noteDrafts[outcome.id];
                  if (note !== undefined && note !== (outcome.resolution_note ?? "")) {
                    updateMutation.mutate({ id: outcome.id, payload: { resolution_note: note } });
                  }
                }}
              />
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

/**
 * Épico F1.2: painel "Insights que valeram a pena" — generaliza o card
 * de valor protegido pelo motor anti-glosa pra QUALQUER categoria que
 * passou pelo ciclo fechado (resolvido + reavaliado pelo job periódico,
 * ver app/worker/insight_outcome_reevaluation_job.py). Só pra quem
 * gerencia (mesmo RBAC de GET /insight-outcomes geral).
 */
function RealizedValueSection() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["insight-outcomes", "realized-summary"],
    queryFn: () => apiClient.get<InsightOutcomesRealizedSummary>("/api/v1/insight-outcomes/realized-summary"),
  });

  return (
    <Panel
      title="Insights que valeram a pena"
      subtitle="Insights marcados resolvidos e reavaliados algumas semanas depois — prova, não promessa."
    >
      {isLoading && <LoadingState variant="cards" rows={3} />}
      {error && <ErrorState message={getApiErrorMessage(error)} onRetry={() => refetch()} />}
      {!isLoading && !error && data && data.items.length === 0 && (
        <EmptyState
          icon={<TrendingUp size={17} strokeWidth={1.5} />}
          message="Ainda nenhum insight reavaliado — leva algumas semanas depois de marcado resolvido."
        />
      )}
      {data && data.items.length > 0 && (
        <>
          <div className="flex items-baseline gap-2 px-5 pt-4">
            <span className="font-mono text-xl font-semibold text-revenue">{formatCurrency(data.total_delta_realized)}</span>
            <span className="text-xs text-ink-faint">recuperados em {data.total_resolved_and_reevaluated} insight(s)</span>
          </div>
          <div className="mt-3 divide-y divide-border-hairline">
            {data.items.map((outcome) => (
              <div key={outcome.id} className="px-5 py-3">
                <h4 className="text-sm font-medium text-ink">{outcome.title}</h4>
                <p className="mt-0.5 text-2xs text-ink-faint">
                  Impacto quando marcado: {outcome.financial_impact_snapshot !== null ? formatCurrency(outcome.financial_impact_snapshot) : "—"}
                  {" · "}
                  Impacto na reavaliação: {outcome.resolved_metric_value !== null ? formatCurrency(outcome.resolved_metric_value) : "—"}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </Panel>
  );
}

const _MANAGER_ROLES = new Set(["owner", "admin", "financeiro", "auditor"]);

export function MyInsightsPage() {
  const { user } = useAuth();
  const canSeeRealizedValue = Boolean(user && _MANAGER_ROLES.has(user.role));

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ClipboardList}
        title="Meus insights"
        subtitle="Épicos F1.2/F1.3 do Plano Diretor: o que foi atribuído a você, e o que já provou que funcionou."
      />
      <MyPendingSection />
      {canSeeRealizedValue && <RealizedValueSection />}
    </div>
  );
}
