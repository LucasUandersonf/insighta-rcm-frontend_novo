import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, UserPlus } from "lucide-react";
import { Panel, LoadingState, ErrorState, EmptyState } from "@/components/ui/Panel";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { SelectField, TextField } from "@/components/ui/FormField";
import { InsightActionButton } from "@/components/dashboard/SmartInsightsFeed";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { cn } from "@/lib/cn";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import type {
  AgendaFocus,
  InsightCategory,
  InsightOutcome,
  InsightOutcomeCreateRequest,
  InsightSeverity,
  PlatformUser,
  PriorityQueue,
  PriorityQueueItem,
} from "@/lib/types";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

const SEVERITY_TONE: Record<InsightSeverity, BadgeTone> = {
  critical: "denied",
  warning: "pending",
  positive: "revenue",
  comparativo: "comparativo",
};

const SEVERITY_LABEL: Record<InsightSeverity, string> = {
  critical: "Crítico",
  warning: "Atenção",
  positive: "Eficiência",
  comparativo: "Comparativo",
};

const CATEGORY_LABEL: Record<InsightCategory, string> = {
  faturamento: "Faturamento",
  agenda: "Agenda",
  estrategia: "Estratégia",
};

// Épico F1.3: só quem GERENCIA (mesmo _MANAGER_ROLES de
// insight_outcome_service.py no backend) vê os botões de ação da fila
// — auditor enxerga a fila (leitura), mas não cria/atribui outcome.
const _MANAGER_ROLES = new Set(["owner", "admin", "financeiro"]);

function itemKey(item: PriorityQueueItem): string {
  return `${item.category}:${item.title}`;
}

/**
 * Épico F1.3: modal de atribuição — escolhe um colega (GET /users,
 * agora liberado pra financeiro também — ver DECISÃO em
 * app/api/v1/endpoints/users.py) e um prazo, cria o insight_outcome já
 * atribuído (status "pendente"). Quem foi atribuído vê isso depois em
 * "Meus insights" (MyInsightsPage.tsx).
 */
function AssignModal({
  item,
  onClose,
  onAssigned,
}: {
  item: PriorityQueueItem | null;
  onClose: () => void;
  onAssigned: (item: PriorityQueueItem) => void;
}) {
  const { showSuccess, showError } = useToast();
  const [assignedTo, setAssignedTo] = useState("");
  const [dueDate, setDueDate] = useState("");

  const { data: users } = useQuery({
    queryKey: ["users"],
    queryFn: () => apiClient.get<PlatformUser[]>("/api/v1/users"),
    enabled: Boolean(item),
  });

  const mutation = useMutation({
    mutationFn: (payload: InsightOutcomeCreateRequest) => apiClient.post<InsightOutcome>("/api/v1/insight-outcomes", payload),
    onSuccess: () => {
      showSuccess("Insight atribuído.");
      if (item) onAssigned(item);
      handleClose();
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  function handleClose() {
    setAssignedTo("");
    setDueDate("");
    onClose();
  }

  if (!item) return null;

  function handleSubmit() {
    if (!item || !assignedTo) return;
    mutation.mutate({
      source: item.source,
      category: item.category,
      severity: item.severity,
      title: item.title,
      message: item.message,
      financial_impact: item.financial_impact,
      assigned_to: assignedTo,
      due_date: dueDate || null,
    });
  }

  return (
    <Modal title="Atribuir insight" isOpen={Boolean(item)} onClose={handleClose}>
      <p className="mb-4 text-xs text-ink-faint">{item.title}</p>
      <SelectField label="Atribuir para" required value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
        <option value="">Selecione...</option>
        {(users ?? []).map((u) => (
          <option key={u.id} value={u.id}>
            {u.full_name} ({u.role})
          </option>
        ))}
      </SelectField>
      <TextField label="Prazo (opcional)" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={handleClose}>
          Cancelar
        </Button>
        <Button onClick={handleSubmit} disabled={!assignedTo || mutation.isPending}>
          {mutation.isPending ? "Atribuindo..." : "Atribuir"}
        </Button>
      </div>
    </Modal>
  );
}

/**
 * Épico F1.1 do Plano Diretor ("Fila única de ação priorizada"): "Hoje
 * os 39 mecanismos vivem espalhados em abas [...] O gestor decide
 * sozinho, de cabeça, o que atacar primeiro." Esta é a tela "Hoje" —
 * página inicial da Sala de Comando — consumindo GET /priority-queue
 * (agregação de generate_insights() + os painéis do Raio-X que nunca
 * viram card de feed sozinho, ver DECISÃO no backend).
 *
 * Cada item mostra a categoria de ORIGEM como badge (nunca esconde a
 * proveniência) e o mesmo botão de ação já usado no feed completo
 * (InsightActionButton, reaproveitado — ver DECISÃO em
 * SmartInsightsFeed.tsx). "Marcar como resolvido"/"Atribuir" (épicos
 * F1.2/F1.3) criam um insight_outcome — "é onde o botão 'marcar como
 * resolvido' mora", como o próprio Plano Diretor descreve.
 */
export function PriorityQueuePanel({
  dateFrom,
  dateTo,
  onNavigateTab,
  onFocusAgenda,
}: {
  dateFrom: string;
  dateTo: string;
  onNavigateTab?: (tabId: string) => void;
  onFocusAgenda?: (focus: AgendaFocus) => void;
}) {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();
  const canManage = Boolean(user && _MANAGER_ROLES.has(user.role));
  const [assigningItem, setAssigningItem] = useState<PriorityQueueItem | null>(null);
  // Marca localmente o que já foi acionado nesta sessão — a fila só
  // recalcula no próximo carregamento (o problema-fonte ainda existe
  // até alguém de fato agir nele), então sem isso o botão continuaria
  // clicável pro mesmo item depois de já resolvido/atribuído.
  const [actionedKeys, setActionedKeys] = useState<Record<string, "resolvido" | "atribuido">>({});

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["analytics", "priority-queue", dateFrom, dateTo],
    queryFn: () =>
      apiClient.get<PriorityQueue>(`/api/v1/analytics/priority-queue?date_from=${dateFrom}&date_to=${dateTo}`),
  });

  const resolveMutation = useMutation({
    mutationFn: async (item: PriorityQueueItem) => {
      const outcome = await apiClient.post<InsightOutcome>("/api/v1/insight-outcomes", {
        source: item.source,
        category: item.category,
        severity: item.severity,
        title: item.title,
        message: item.message,
        financial_impact: item.financial_impact,
      } satisfies InsightOutcomeCreateRequest);
      await apiClient.patch<InsightOutcome>(`/api/v1/insight-outcomes/${outcome.id}`, { status: "resolvido" });
      return item;
    },
    onSuccess: (item) => {
      showSuccess("Marcado como resolvido — reavaliamos o resultado em algumas semanas.");
      setActionedKeys((prev) => ({ ...prev, [itemKey(item)]: "resolvido" }));
      queryClient.invalidateQueries({ queryKey: ["insight-outcomes"] });
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  return (
    <Panel
      title="O que atacar primeiro"
      subtitle="Fila única, cruzando faturamento, agenda e estratégia — ordenada pelo maior impacto em R$."
    >
      {isLoading && <LoadingState variant="cards" rows={4} />}
      {error && <ErrorState message={getApiErrorMessage(error)} onRetry={() => refetch()} />}
      {!isLoading && !error && data && data.items.length === 0 && (
        <EmptyState
          icon={<CheckCircle2 size={17} strokeWidth={1.5} />}
          message="Nenhuma ação prioritária agora — os alertas abertos estão sob controle nesta janela."
        />
      )}
      {!isLoading && data && data.items.length > 0 && (
        <div className="divide-y divide-border-hairline">
          {data.items.map((item, idx) => {
            const key = itemKey(item);
            const actioned = actionedKeys[key];
            return (
              <div key={`${item.source}-${idx}`} className="flex gap-3 px-5 py-4">
                <span className="mt-0.5 font-mono text-xs text-ink-faint">{idx + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-1.5">
                    <Badge tone={SEVERITY_TONE[item.severity]}>{SEVERITY_LABEL[item.severity]}</Badge>
                    <span className="text-2xs text-ink-faint">{CATEGORY_LABEL[item.category]}</span>
                    {item.source === "raiox" && (
                      <span
                        className="rounded-full border border-border-subtle px-2 py-0.5 text-2xs text-ink-faint"
                        title="Extraído de um painel do Raio-X da Receita, não do feed de insights"
                      >
                        Raio-X
                      </span>
                    )}
                    {actioned && (
                      <Badge tone={actioned === "resolvido" ? "revenue" : "accent"}>
                        {actioned === "resolvido" ? "Marcado como resolvido" : "Atribuído"}
                      </Badge>
                    )}
                  </div>
                  <h4 className="text-sm font-medium text-ink">{item.title}</h4>
                  <p className="mt-1 text-xs leading-relaxed text-ink-muted">{item.message}</p>
                  <div className={cn("mt-2 flex flex-wrap items-center gap-3")}>
                    {item.financial_impact !== null && (
                      <span className="font-mono text-sm font-medium text-ink">
                        {formatCurrency(item.financial_impact)}
                      </span>
                    )}
                    <InsightActionButton
                      insight={item}
                      onNavigateTab={onNavigateTab}
                      onFocusAgenda={onFocusAgenda}
                      toneClass="text-ink-muted"
                    />
                    {canManage && !actioned && (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          onClick={() => resolveMutation.mutate(item)}
                          disabled={resolveMutation.isPending}
                        >
                          Marcar como resolvido
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          className="flex items-center gap-1"
                          onClick={() => setAssigningItem(item)}
                        >
                          <UserPlus size={12} />
                          Atribuir
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {data && data.total_considered > data.items.length && (
        <p className="border-t border-border-hairline px-5 py-3 text-2xs text-ink-faint">
          Mostrando {data.items.length} de {data.total_considered} ações abertas nesta janela.
        </p>
      )}

      <AssignModal
        item={assigningItem}
        onClose={() => setAssigningItem(null)}
        onAssigned={(item) => setActionedKeys((prev) => ({ ...prev, [itemKey(item)]: "atribuido" }))}
      />
    </Panel>
  );
}
