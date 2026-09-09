import { useQuery } from "@tanstack/react-query";
import { Target } from "lucide-react";
import { BentoCard } from "@/components/ui/BentoGrid";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/Panel";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import type { Oportunidades, OportunidadeItem } from "@/lib/types";

/**
 * Aba Oportunidades — Sala de Comando 2.0, Nível 1 do roadmap ("só
 * existe em escala"): ranking de contratos cujo preço acordado está
 * ABAIXO da mediana de outras clínicas para o mesmo convênio+
 * procedimento (ver DECISÃO completa em
 * app/sql/033_network_contract_price_benchmark.sql, backend) — "por
 * onde vale mais a pena começar a renegociar". Substitui o placeholder
 * "Em construção" desta aba.
 */

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatCurrencyCompact(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
}

function OportunidadeRow({ item, rank }: { item: OportunidadeItem; rank: number }) {
  return (
    <tr className="border-b border-border-hairline last:border-0">
      <td className="whitespace-nowrap py-3 pl-4 pr-3 text-2xs font-semibold text-ink-faint">#{rank}</td>
      <td className="py-3 pr-3">
        <p className="text-sm font-medium text-ink">{item.plan_display_name}</p>
        <p className="mt-0.5 text-xs text-ink-muted">{item.procedure_name ?? `Código TUSS ${item.tuss_code}`}</p>
      </td>
      <td className="tabular whitespace-nowrap py-3 pr-3 text-right text-sm text-ink-muted">{formatCurrency(item.your_price)}</td>
      <td className="tabular whitespace-nowrap py-3 pr-3 text-right text-sm text-ink">{formatCurrency(item.network_median_price)}</td>
      <td className="tabular whitespace-nowrap py-3 pr-3 text-right text-sm font-medium text-tier1">
        +{formatCurrency(item.gap_value)}
        <span className="ml-1 text-2xs text-ink-faint">({(item.gap_pct * 100).toFixed(0)}%)</span>
      </td>
      <td className="tabular whitespace-nowrap py-3 pr-3 text-right text-xs text-ink-muted">
        {item.monthly_volume > 0 ? `${item.monthly_volume.toFixed(1)}/mês` : "sem volume recente"}
      </td>
      <td className="tabular whitespace-nowrap py-3 pl-3 pr-4 text-right text-sm font-semibold text-revenue">
        {item.estimated_monthly_opportunity > 0 ? formatCurrencyCompact(item.estimated_monthly_opportunity) : "—"}
      </td>
    </tr>
  );
}

export function OportunidadesPanel() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["analytics", "oportunidades"],
    queryFn: () => apiClient.get<Oportunidades>("/api/v1/analytics/oportunidades"),
  });

  if (isLoading) return <LoadingState variant="cards" rows={4} />;
  if (error) return <ErrorState message={getApiErrorMessage(error)} />;
  if (!data) return null;

  const totalOpportunity = data.items.reduce((sum, i) => sum + i.estimated_monthly_opportunity, 0);

  return (
    <div className="space-y-4">
      <p className="max-w-2xl text-xs text-ink-muted">
        Procedimentos que sua clínica já tem contratados com algum convênio, mas com preço abaixo do que outras
        clínicas da base Insighta conseguem para o mesmo convênio e o mesmo procedimento — ordenado por quanto vale
        mais a pena renegociar primeiro. Só entram aqui pares com clínicas suficientes na comparação para não
        arriscar um número por acaso.
      </p>

      {data.items.length === 0 ? (
        <EmptyState
          icon={<Target size={17} strokeWidth={1.5} />}
          message="Nenhuma oportunidade de renegociação identificada por enquanto — ou seus preços já estão no nível da rede, ou ainda não há clínicas suficientes com o mesmo convênio e procedimento para comparar com segurança."
        />
      ) : (
        <>
          <BentoCard colSpan={12} glow="revenue" className="border border-revenue/25 bg-revenue-bg">
            <p className="text-2xs font-medium uppercase tracking-wide text-ink-faint">Oportunidade total estimada por mês</p>
            <p className="tabular mt-1 text-2xl font-semibold text-revenue sm:text-3xl">{formatCurrency(totalOpportunity)}</p>
            <p className="mt-1 text-xs text-ink-muted">
              Somando as {data.items.length} oportunidade{data.items.length > 1 ? "s" : ""} listada
              {data.items.length > 1 ? "s" : ""} abaixo, pelo volume recente de cada procedimento.
            </p>
          </BentoCard>

          <BentoCard colSpan={12} noPadding>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left">
                <thead>
                  <tr className="border-b border-border-hairline text-2xs font-medium uppercase tracking-wide text-ink-faint">
                    <th className="py-3 pl-4 pr-3">#</th>
                    <th className="py-3 pr-3">Convênio / Procedimento</th>
                    <th className="py-3 pr-3 text-right">Seu preço</th>
                    <th className="py-3 pr-3 text-right">Mediana da rede</th>
                    <th className="py-3 pr-3 text-right">Gap</th>
                    <th className="py-3 pr-3 text-right">Volume</th>
                    <th className="py-3 pl-3 pr-4 text-right">Oportunidade/mês</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item, idx) => (
                    <OportunidadeRow key={`${item.insurance_plan_id}-${item.tuss_code}`} item={item} rank={idx + 1} />
                  ))}
                </tbody>
              </table>
            </div>
          </BentoCard>
        </>
      )}
    </div>
  );
}
