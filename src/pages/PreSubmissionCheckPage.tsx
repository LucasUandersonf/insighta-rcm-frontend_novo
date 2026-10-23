import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Panel, EmptyState, LoadingState, ErrorState } from "@/components/ui/Panel";
import { PageHeader } from "@/components/ui/PageHeader";
import { brl, PreSubmissionIssues, VerdictBadge } from "@/components/money/PreSubmissionIssues";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { formatDateBR } from "@/lib/dates";
import type { PreSubmissionGroup, PreSubmissionOverview } from "@/lib/types";

function GroupDetail({ groupKey }: { groupKey: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["financeiro", "conferencia-envio", groupKey],
    queryFn: () =>
      apiClient.get<PreSubmissionGroup>(`/api/v1/financeiro/conferencia-envio/detalhe?key=${encodeURIComponent(groupKey)}`),
  });
  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={getApiErrorMessage(error)} />;
  return data ? <PreSubmissionIssues group={data} /> : null;
}

/**
 * Conferência antes do envio: tudo o que ainda não foi mandado ao convênio,
 * por convênio e lote, com o veredito e o R$ de cada problema. Corrigir
 * antes de enviar é a forma mais barata de não tomar glosa.
 */
export function PreSubmissionCheckPage() {
  const [open, setOpen] = useState<string | null>(null);
  const { data, isLoading, error } = useQuery({
    queryKey: ["financeiro", "conferencia-envio"],
    queryFn: () => apiClient.get<PreSubmissionOverview>("/api/v1/financeiro/conferencia-envio"),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Conferência antes do envio"
        subtitle="Antes de mandar o lote ao convênio: o que vai voltar glosado, o que dá para cobrar a mais e o que já pode seguir."
      />
      {isLoading && <LoadingState />}
      {error && <ErrorState message={getApiErrorMessage(error)} />}
      {data && data.groups.length === 0 && (
        <Panel>
          <EmptyState message="Nenhuma conta esperando envio. Quando o ERP mandar o faturamento da noite, a conferência aparece aqui." />
        </Panel>
      )}
      {data && data.groups.length > 0 && (
        <>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-border-hairline bg-glass px-4 py-3">
              <dt className="text-xs text-ink-faint">Esperando envio</dt>
              <dd className="text-lg font-semibold tabular text-ink">{brl(data.total_value)}</dd>
              <dd className="text-2xs text-ink-faint">{data.total_items} contas</dd>
            </div>
            <div className="rounded-lg border border-border-hairline bg-glass px-4 py-3">
              <dt className="text-xs text-ink-faint">Com problema que bloqueia</dt>
              <dd className="text-lg font-semibold tabular text-denied">{brl(data.blocking_value)}</dd>
            </div>
            <div className="rounded-lg border border-border-hairline bg-glass px-4 py-3">
              <dt className="text-xs text-ink-faint">Dá para cobrar a mais</dt>
              <dd className="text-lg font-semibold tabular text-revenue">{brl(data.gain_value)}</dd>
            </div>
            <div className="rounded-lg border border-border-hairline bg-glass px-4 py-3">
              <dt className="text-xs text-ink-faint">Lotes</dt>
              <dd className="text-lg font-semibold tabular text-ink">
                {data.ready_groups} prontos · {data.review_groups} a revisar
              </dd>
            </div>
          </dl>
          {data.truncated && (
            <p className="text-xs text-pending">São muitas contas: a conferência mostra as 20 mil mais antigas.</p>
          )}
          <Panel title="Por convênio e lote" subtitle="Os que precisam de revisão primeiro, os de maior valor no topo.">
            <ul className="divide-y divide-border-hairline">
              {data.groups.map((g) => {
                const expanded = open === g.key;
                return (
                  <li key={g.key} className="py-3">
                    <button
                      type="button"
                      className="flex w-full flex-wrap items-center justify-between gap-3 text-left"
                      aria-expanded={expanded}
                      onClick={() => setOpen(expanded ? null : g.key)}
                    >
                      <span className="flex items-center gap-2">
                        {expanded ? <ChevronDown aria-hidden size={16} /> : <ChevronRight aria-hidden size={16} />}
                        <span>
                          <span className="block text-sm font-semibold text-ink">
                            {g.plan_name} · {g.lote_label}
                          </span>
                          <span className="block text-xs text-ink-muted">
                            {g.items} contas · {brl(g.total_value)}
                            {g.oldest_service_date &&
                              ` · mais antiga de ${formatDateBR(g.oldest_service_date, { day: "2-digit", month: "2-digit" })}`}
                          </span>
                        </span>
                      </span>
                      <span className="flex items-center gap-3">
                        {g.blocking_items > 0 && (
                          <span className="text-xs tabular text-denied">
                            {g.blocking_items} com problema · {brl(g.blocking_value)}
                          </span>
                        )}
                        <VerdictBadge verdict={g.verdict} />
                      </span>
                    </button>
                    {expanded && (
                      <div className="mt-3 pl-6">
                        <GroupDetail groupKey={g.key} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Panel>
        </>
      )}
    </div>
  );
}
