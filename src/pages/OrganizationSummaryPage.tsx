import { useQuery } from "@tanstack/react-query";
import { Network } from "lucide-react";
import { Panel, EmptyState, LoadingState, ErrorState } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import type { OrganizationSummary, OrganizationUnitSummary } from "@/lib/types";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatPct(rate: number | null): string {
  return rate === null ? "—" : `${(rate * 100).toFixed(0)}%`;
}

// Mesmo espírito de LOW_COMPLETION_THRESHOLD em DataQualityPanel.tsx —
// corte de DESTAQUE visual, não uma meta oficial: só sinaliza qual
// unidade merece um olhar primeiro no risco de glosa.
const HIGH_DENIAL_RISK_THRESHOLD = 0.25;

function UnitRow({ unit }: { unit: OrganizationUnitSummary }) {
  return (
    <tr className="border-b border-border-hairline last:border-0">
      <td className="py-2.5 pr-3 text-[13px] text-ink">
        {unit.trade_name}
        {unit.is_requesting_tenant && (
          <span className="ml-2 inline-block">
            <Badge tone="accent">Esta unidade</Badge>
          </span>
        )}
      </td>
      <td className="py-2.5 pr-3 text-right font-mono text-[13px] tabular text-ink-muted">
        {formatCurrency(unit.total_billed)}
      </td>
      <td
        className={`py-2.5 pr-3 text-right font-mono text-[13px] tabular ${
          unit.denial_risk_pct !== null && unit.denial_risk_pct >= HIGH_DENIAL_RISK_THRESHOLD ? "text-denied" : "text-ink-muted"
        }`}
      >
        {formatPct(unit.denial_risk_pct)}
      </td>
      <td className="py-2.5 pr-3 text-right font-mono text-[13px] tabular text-ink-muted">{formatPct(unit.no_show_rate)}</td>
      <td className="py-2.5 text-right font-mono text-[13px] tabular text-ink-muted">{unit.appointment_count}</td>
    </tr>
  );
}

/**
 * Épico F3.2 do Plano Diretor ("Consolidação multi-unidade") — dashboard
 * consolidado comparando as unidades (Tenants) do MESMO grupo lado a
 * lado. `organization_id` é atribuído por ops (ver create_admin.py
 * --organization-name), nunca self-service dentro do produto — esta
 * tela é só leitura.
 */
export function OrganizationSummaryPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["analytics", "organization-summary"],
    queryFn: () => apiClient.get<OrganizationSummary>("/api/v1/analytics/organization-summary"),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Network}
        title="Consolidado multi-unidade"
        subtitle="Suas unidades lado a lado — últimos 30 dias."
      />

      {isLoading && <LoadingState />}
      {error && <ErrorState message={getApiErrorMessage(error)} />}

      {!isLoading && !error && data && !data.belongs_to_organization && (
        <Panel title="Consolidado">
          <EmptyState
            icon={<Network size={18} strokeWidth={1.5} />}
            message="Esta clínica não faz parte de um grupo multi-unidade. A consolidação agrupa várias unidades do mesmo dono num único painel comparativo — se sua clínica tem mais de uma unidade e você quer vê-las aqui, fale com o suporte da Insighta."
          />
        </Panel>
      )}

      {!isLoading && !error && data && data.belongs_to_organization && (
        <>
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Panel title="Faturamento consolidado">
              <p className="p-4 font-mono text-2xl tabular text-ink">{formatCurrency(data.consolidated_total_billed)}</p>
            </Panel>
            <Panel title="Risco de glosa consolidado">
              <p className="p-4 font-mono text-2xl tabular text-ink">{formatPct(data.consolidated_denial_risk_pct)}</p>
            </Panel>
            <Panel title="Taxa de falta consolidada">
              <p className="p-4 font-mono text-2xl tabular text-ink">{formatPct(data.consolidated_no_show_rate)}</p>
            </Panel>
          </section>

          <Panel title={data.organization_name ?? "Unidades"} subtitle={`${data.units.length} unidade(s) — últimos ${data.window_days} dias`}>
            <div className="overflow-x-auto p-4">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border-hairline text-2xs uppercase tracking-wide text-ink-faint">
                    <th className="pb-2 text-left font-medium">Unidade</th>
                    <th className="pb-2 text-right font-medium">Faturado</th>
                    <th className="pb-2 text-right font-medium">Risco de glosa</th>
                    <th className="pb-2 text-right font-medium">Taxa de falta</th>
                    <th className="pb-2 text-right font-medium">Atendimentos</th>
                  </tr>
                </thead>
                <tbody>
                  {data.units.map((unit) => (
                    <UnitRow key={unit.tenant_id} unit={unit} />
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
