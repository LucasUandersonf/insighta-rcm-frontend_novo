import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { AssignDemandModal } from "@/components/team/AssignDemandModal";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import type { InsightOutcome, InsightOutcomeCreateRequest, PriorityQueueItem, SmartInsight } from "@/lib/types";

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
// Equipe (Redesign 2026): só o GESTOR (owner/admin) atribui e marca
// resolvido direto — financeiro virou coordenador de Faturamento e
// resolve pelas próprias demandas (ver CoordinatorHomePage).
export const INSIGHT_MANAGER_ROLES = new Set(["owner", "admin"]);

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
 * Redesign 2026 (canvas "Atribuir"): o gestor atribui ao COORDENADOR DO
 * SETOR, não a uma pessoa avulsa — ver AssignDemandModal. Mantido com o
 * nome antigo para os consumidores (Home, Hoje, Diagnóstico, fila).
 */
export const AssignModal = AssignDemandModal;

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
}: {
  item: PriorityQueueItem;
  canManage: boolean;
  actioned: "resolvido" | "atribuido" | undefined;
  onResolve: (item: PriorityQueueItem) => void;
  onAssign: (item: PriorityQueueItem) => void;
  resolvePending: boolean;
  /** Mantido por compatibilidade — os botões seguem o estilo neutro do canvas Redesign 2026. */
  toneClass?: string;
}) {
  if (!canManage || actioned) return null;
  return (
    <>
      <Button type="button" variant="secondary" size="sm" className="flex items-center gap-1.5" onClick={() => onAssign(item)}>
        <UserPlus aria-hidden size={13} className="text-ink-muted" />
        Atribuir
      </Button>
      <Button type="button" variant="secondary" size="sm" className="flex items-center gap-1.5 bg-transparent" onClick={() => onResolve(item)} disabled={resolvePending}>
        <Check aria-hidden size={13} className="text-revenue" />
        Marcar como resolvido
      </Button>
    </>
  );
}

export function ActionedBadge({ actioned }: { actioned: "resolvido" | "atribuido" | undefined }) {
  if (!actioned) return null;
  return <Badge tone={actioned === "resolvido" ? "revenue" : "accent"}>{actioned === "resolvido" ? "Marcado como resolvido" : "Atribuído"}</Badge>;
}
