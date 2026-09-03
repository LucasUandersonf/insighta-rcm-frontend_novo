import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Building2 } from "lucide-react";
import { Panel, EmptyState, LoadingState, ErrorState } from "@/components/ui/Panel";
import { ChartTooltip } from "@/components/dashboard/ChartTooltip";
import { useTheme } from "@/context/ThemeContext";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { CHART_PALETTE } from "@/lib/chartTheme";
import type { PlanLossRanking } from "@/lib/types";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

// Versão compacta ("R$ 1,2 mil") só para os rótulos do eixo — o valor
// exato de verdade continua no tooltip ao passar o mouse e na tabela
// abaixo do gráfico, aqui é só para o eixo não estourar largura com
// valores grandes.
function formatCurrencyCompact(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact" }).format(value);
}

// Só os N piores entram no gráfico de barras — uma clínica com muitos
// convênios cadastrados viraria um gráfico ilegível; a tabela abaixo,
// essa sim, lista todos (ver DECISÃO em BentoCard/Panel de nunca cortar
// dado silenciosamente, só a REPRESENTAÇÃO visual do gráfico).
const CHART_TOP_N = 8;

/**
 * Painel → Faturamento: une as três fontes de perda financeira que já
 * existiam separadas por convênio (buraco de cobrança, divergência de
 * recebimento, valor em risco de glosa) num único ranking — a resposta
 * direta ao pedido "numerar os convênios com maior perda financeira".
 *
 * DECISÃO — os 3 componentes continuam visíveis na tabela, nunca só o total
 * -------------------------------------------------------------------
 * Mesmo cuidado do backend (ver PlanLossItem em app/schemas/analytics.py):
 * "perda total" de R$ 10.000 significa ações bem diferentes se vem de
 * buraco de cobrança (revisar tabela de preço cadastrada) ou de
 * divergência de recebimento (abrir contestação com a operadora) — só o
 * total escondia essa decisão.
 */
export function PlanLossRankingPanel({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const { resolvedTheme } = useTheme();
  const palette = CHART_PALETTE[resolvedTheme];
  const axisStyle = { stroke: palette.axis, fontSize: 11 };

  const { data, isLoading, error } = useQuery({
    queryKey: ["analytics", "plan-loss-ranking", dateFrom, dateTo],
    queryFn: () =>
      apiClient.get<PlanLossRanking>(`/api/v1/analytics/plan-loss-ranking?date_from=${dateFrom}&date_to=${dateTo}`),
  });

  const plans = data?.plans ?? [];
  const chartData = plans.slice(0, CHART_TOP_N).map((p) => ({ convenio: p.plan_name, perda: Math.round(p.total_loss * 100) / 100 }));

  return (
    <Panel
      title="Ranking de convênios por perda financeira"
      subtitle="Divergência de cobrança + divergência de recebimento + valor em risco de glosa, somados por operadora"
    >
      {isLoading && <LoadingState variant="table" rows={4} />}
      {error && <ErrorState message={getApiErrorMessage(error)} />}
      {!isLoading && !error && plans.length === 0 && (
        <EmptyState icon={<Building2 size={17} strokeWidth={1.5} />} message="Nenhuma perda financeira identificada por convênio nesta janela." />
      )}

      {!isLoading && plans.length > 0 && (
        <>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={Math.max(chartData.length * 42, 120)}>
              <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="barGradientPlanLoss" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={palette.loss} stopOpacity={0.7} />
                    <stop offset="100%" stopColor={palette.loss} stopOpacity={1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} horizontal={false} />
                <XAxis type="number" {...axisStyle} tickLine={false} axisLine={{ stroke: palette.grid }} tickFormatter={formatCurrencyCompact} />
                <YAxis type="category" dataKey="convenio" {...axisStyle} tickLine={false} axisLine={false} width={140} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: palette.grid, opacity: 0.35 }} formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="perda" fill="url(#barGradientPlanLoss)" name="Perda total" radius={[0, 3, 3, 0]} animationDuration={700} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-t border-b border-border-hairline text-2xs uppercase tracking-wide text-ink-faint">
                <th className="px-4 py-2.5 font-medium">Convênio</th>
                <th className="px-4 py-2.5 font-medium">Divergência de cobrança</th>
                <th className="px-4 py-2.5 font-medium">Divergência de recebimento</th>
                <th className="px-4 py-2.5 font-medium">Valor em risco de glosa</th>
                <th className="px-4 py-2.5 text-right font-medium">Perda total</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr key={plan.plan_name} className="border-b border-border-hairline last:border-0 transition-colors hover:bg-canvas-raised/60">
                  <td className="px-4 py-2.5 text-ink">{plan.plan_name}</td>
                  <td className="px-4 py-2.5 text-ink-muted">{plan.financial_hole > 0 ? formatCurrency(plan.financial_hole) : "—"}</td>
                  <td className="px-4 py-2.5 text-ink-muted">{plan.payment_gap > 0 ? formatCurrency(plan.payment_gap) : "—"}</td>
                  <td className="px-4 py-2.5 text-ink-muted">{plan.denial_risk_value > 0 ? formatCurrency(plan.denial_risk_value) : "—"}</td>
                  <td className="tabular px-4 py-2.5 text-right font-mono text-denied">{formatCurrency(plan.total_loss)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Panel>
  );
}
