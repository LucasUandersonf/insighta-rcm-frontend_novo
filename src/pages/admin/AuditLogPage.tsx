import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScrollText } from "lucide-react";
import { Panel, EmptyState, LoadingState, ErrorState } from "@/components/ui/Panel";
import { FilterBar } from "@/components/ui/FilterBar";
import { Pagination } from "@/components/ui/Pagination";
import { SelectField } from "@/components/ui/FormField";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import type { AuditLogEntry, PaginatedResponse } from "@/lib/types";

const PAGE_SIZE = 30;

const ACTION_LABELS: Record<string, string> = {
  create: "Criação",
  update: "Atualização",
  delete: "Remoção",
};

const ACTION_TONE: Record<string, BadgeTone> = {
  create: "revenue",
  update: "pending",
  delete: "denied",
};

// Valores espelham os nomes de entidade usados no restante do produto
// (billing/contract/user) — ver DECISÃO em
// app/api/v1/endpoints/audit_log.py no backend: `core.audit_log` ainda
// não é gravado por nenhum fluxo hoje, então esta lista é a melhor
// aproximação disponível até existir instrumentação real.
const ENTITY_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "billing", label: "Faturamento" },
  { value: "contract", label: "Contrato" },
  { value: "user", label: "Usuário" },
];

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
        title="Logs de auditoria"
        subtitle="Trilha de quem fez o quê, quando — toda alteração de dado sensível (contratos, recursos de glosa, usuários, integrações) fica registrada aqui, sem edição possível."
      />

      <Panel>
        <FilterBar hasActiveFilters={hasActiveFilters} onClear={clearFilters}>
          <div className="w-48">
            <SelectField
              label="Tipo de entidade"
              value={entityType}
              onChange={(e) => {
                setEntityType(e.target.value);
                setOffset(0);
              }}
              className="mb-0"
            >
              <option value="">Todas</option>
              {ENTITY_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </SelectField>
          </div>
          <div className="w-44">
            <SelectField
              label="Ação"
              value={action}
              onChange={(e) => {
                setAction(e.target.value);
                setOffset(0);
              }}
              className="mb-0"
            >
              <option value="">Todas</option>
              {Object.entries(ACTION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectField>
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
                <th className="px-4 py-2.5 font-medium">Data/hora</th>
                <th className="px-4 py-2.5 font-medium">Usuário</th>
                <th className="px-4 py-2.5 font-medium">Ação</th>
                <th className="px-4 py-2.5 font-medium">Entidade</th>
                <th className="px-4 py-2.5 font-medium">Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {(data?.items ?? []).map((entry) => (
                <tr key={entry.id} className="border-b border-border-hairline last:border-0 transition-colors hover:bg-canvas-raised/60">
                  <td className="tabular px-4 py-2.5 font-mono text-ink-muted">{formatDateTime(entry.created_at)}</td>
                  <td className="px-4 py-2.5 text-ink">{entry.actor_name ?? "Sistema"}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone={ACTION_TONE[entry.action] ?? "neutral"}>{ACTION_LABELS[entry.action] ?? entry.action}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-ink-muted">{entry.entity_type}</td>
                  <td className="px-4 py-2.5 text-ink-faint">
                    {entry.diff ? (
                      <code className="text-2xs">{JSON.stringify(entry.diff)}</code>
                    ) : (
                      <span className="font-mono text-2xs">{entry.entity_id}</span>
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
