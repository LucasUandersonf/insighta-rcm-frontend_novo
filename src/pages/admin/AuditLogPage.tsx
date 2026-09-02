import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScrollText } from "lucide-react";
import { Panel, EmptyState, LoadingState, ErrorState } from "@/components/ui/Panel";
import { FilterBar } from "@/components/ui/FilterBar";
import { Pagination } from "@/components/ui/Pagination";
import { TextField } from "@/components/ui/FormField";
import { PageHeader } from "@/components/ui/PageHeader";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import type { AuditLogEntry, PaginatedResponse } from "@/lib/types";

const PAGE_SIZE = 30;

const ACTION_LABELS: Record<string, string> = {
  create: "Criação",
  update: "Atualização",
  delete: "Remoção",
};

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium" }).format(new Date(iso));
}

export function AuditLogPage() {
  const [offset, setOffset] = useState(0);
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");

  const hasActiveFilters = entityType !== "" || action !== "";

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["audit-log", offset, entityType, action],
    queryFn: () => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
      if (entityType) params.set("entity_type", entityType);
      if (action) params.set("action", action);
      return apiClient.get<PaginatedResponse<AuditLogEntry>>(`/api/v1/audit-log?${params.toString()}`);
    },
  });

  function clearFilters() {
    setEntityType("");
    setAction("");
    setOffset(0);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ScrollText}
        title="Logs de Auditoria"
        subtitle="Trilha de quem fez o quê, quando — toda alteração de dado sensível (contratos, recursos de glosa, usuários, integrações) fica registrada aqui, sem edição possível."
      />

      <Panel>
        <FilterBar hasActiveFilters={hasActiveFilters} onClear={clearFilters}>
          <div className="w-48">
            <TextField
              label="Tipo de entidade"
              placeholder="ex: contract, denial_appeal"
              value={entityType}
              onChange={(e) => {
                setEntityType(e.target.value);
                setOffset(0);
              }}
              className="mb-0"
            />
          </div>
          <div className="w-48">
            <TextField
              label="Ação"
              placeholder="ex: create, update, delete"
              value={action}
              onChange={(e) => {
                setAction(e.target.value);
                setOffset(0);
              }}
              className="mb-0"
            />
          </div>
        </FilterBar>
        {isLoading && <LoadingState variant="table" rows={6} />}
        {error && <ErrorState message={getApiErrorMessage(error)} onRetry={() => refetch()} />}
        {!isLoading && !error && (data?.items ?? []).length === 0 && (
          <EmptyState icon={<ScrollText size={17} strokeWidth={1.5} />} message="Nenhum evento de auditoria para os filtros atuais." />
        )}
        {!isLoading && (data?.items ?? []).length > 0 && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border-hairline text-2xs uppercase tracking-wide text-ink-faint">
                <th className="px-4 py-2.5 font-medium">Quando</th>
                <th className="px-4 py-2.5 font-medium">Ação</th>
                <th className="px-4 py-2.5 font-medium">Entidade</th>
                <th className="px-4 py-2.5 font-medium">ID</th>
                <th className="px-4 py-2.5 font-medium">Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {(data?.items ?? []).map((entry) => (
                <tr key={entry.id} className="border-b border-border-hairline last:border-0 transition-colors hover:bg-canvas-raised/60">
                  <td className="px-4 py-2.5 text-ink-muted">{formatDateTime(entry.created_at)}</td>
                  <td className="px-4 py-2.5 text-ink">{ACTION_LABELS[entry.action] ?? entry.action}</td>
                  <td className="px-4 py-2.5 text-ink-muted">{entry.entity_type}</td>
                  <td className="tabular px-4 py-2.5 font-mono text-2xs text-ink-faint">{entry.entity_id}</td>
                  <td className="px-4 py-2.5 text-ink-faint">
                    {entry.diff ? (
                      <code className="text-2xs">{JSON.stringify(entry.diff)}</code>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {data && data.total > 0 && (
          <Pagination total={data.total} limit={PAGE_SIZE} offset={offset} onOffsetChange={setOffset} />
        )}
      </Panel>
    </div>
  );
}
