import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { SelectField, TextField } from "@/components/ui/FormField";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { getApiErrorMessage } from "@/lib/query-client";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import type { InsightOutcome, InsightOutcomeCreateRequest, PlatformUser, PriorityQueueItem, SmartInsight } from "@/lib/types";

/**
 * "Junta Técnica Insighta" (reavaliação de mercado da Sala de Comando):
 * atribuição/resolução de insight (épico F1.3) existia só na aba "Hoje"
 * (PriorityQueuePanel) — a aba "Diagnóstico" (SmartInsightsFeed), que é
 * o que a junta técnica avaliou como "feed de insights", não tinha esse
 * botão em NENHUM card. A literatura de gestão citada pela junta é
 * direta: "um indicador de gestão só funciona com [...] um dono
 * responsável" — sem isso em todo lugar onde um insight aparece, o card
 * mais visível do produto (o de Diagnóstico, não o de Hoje) ficava sem
 * a ação mais cobrada pela própria literatura.
 *
 * Extraído de PriorityQueuePanel.tsx para os dois consumidores (Hoje e
 * Diagnóstico) compartilharem a MESMA lógica de atribuição/resolução —
 * duplicar o modal e a mutation arriscaria os dois divergirem quando um
 * dos dois for ajustado no futuro.
 */
export const INSIGHT_MANAGER_ROLES = new Set(["owner", "admin", "financeiro"]);

export function insightItemKey(item: { category: string; title: string }): string {
  return `${item.category}:${item.title}`;
}

/** SmartInsight (Diagnóstico) nunca tem `source` (isso só existe na fila
 * "Hoje", que mistura insight normal com item sintético do Raio-X) —
 * todo insight do feed de Diagnóstico é, por definição, "insight". */
export function toQueueItem(insight: SmartInsight): PriorityQueueItem {
  return { ...insight, source: "insight" };
}

export function useInsightWorkflow() {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();
  const canManage = Boolean(user && INSIGHT_MANAGER_ROLES.has(user.role));
  const [assigningItem, setAssigningItem] = useState<PriorityQueueItem | null>(null);
  // Marca localmente o que já foi acionado nesta sessão — o feed só
  // recalcula no próximo carregamento (o problema-fonte ainda existe até
  // alguém de fato agir nele), então sem isso o botão continuaria
  // clicável pro mesmo item depois de já resolvido/atribuído.
  const [actionedKeys, setActionedKeys] = useState<Record<string, "resolvido" | "atribuido">>({});

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
      setActionedKeys((prev) => ({ ...prev, [insightItemKey(item)]: "resolvido" }));
      queryClient.invalidateQueries({ queryKey: ["insight-outcomes"] });
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  return { canManage, assigningItem, setAssigningItem, actionedKeys, setActionedKeys, resolveMutation };
}

/**
 * Épico F1.3: modal de atribuição — escolhe um colega (GET /users) e um
 * prazo, cria o insight_outcome já atribuído (status "pendente"). Quem
 * foi atribuído vê isso depois em "Meus insights" (MyInsightsPage.tsx).
 */
export function AssignModal({
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

/** Par de botões "Marcar como resolvido"/"Atribuir" + badge de estado já
 * acionado — reaproveitado nos cards da fila "Hoje" (PriorityQueuePanel)
 * e do feed "Diagnóstico" (SmartInsightsFeed), os dois lugares onde um
 * insight aparece como card individual. */
export function InsightWorkflowButtons({
  item,
  canManage,
  actioned,
  onResolve,
  onAssign,
  resolvePending,
  toneClass,
}: {
  item: PriorityQueueItem;
  canManage: boolean;
  actioned: "resolvido" | "atribuido" | undefined;
  onResolve: (item: PriorityQueueItem) => void;
  onAssign: (item: PriorityQueueItem) => void;
  resolvePending: boolean;
  toneClass?: string;
}) {
  if (!canManage || actioned) return null;
  return (
    <>
      <Button type="button" variant="ghost" size="xs" className={toneClass} onClick={() => onResolve(item)} disabled={resolvePending}>
        Marcar como resolvido
      </Button>
      <Button type="button" variant="ghost" size="xs" className={cn("flex items-center gap-1", toneClass)} onClick={() => onAssign(item)}>
        <UserPlus size={12} />
        Atribuir
      </Button>
    </>
  );
}

export function ActionedBadge({ actioned }: { actioned: "resolvido" | "atribuido" | undefined }) {
  if (!actioned) return null;
  return <Badge tone={actioned === "resolvido" ? "revenue" : "accent"}>{actioned === "resolvido" ? "Marcado como resolvido" : "Atribuído"}</Badge>;
}
