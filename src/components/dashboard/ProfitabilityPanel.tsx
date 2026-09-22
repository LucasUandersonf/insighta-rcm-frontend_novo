import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BadgeDollarSign, Receipt } from "lucide-react";
import { BentoCard } from "@/components/ui/BentoGrid";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/Panel";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import type { ProcedureProfitabilityItem, Profitability, ProfessionalProfitabilityItem } from "@/lib/types";

/**
 * Raio-X da Receita, frente "Gestão eficiente" — até esta rodada, o
 * produto media ocupação de agenda e taxa de glosa por profissional
 * SEPARADAMENTE (ver ExecutiveAgendaSummary/Radar de Profissional),
 * nunca receita por hora de agenda OCUPADA: dois profissionais podem
 * ter a mesma ocupação e gerar receitas bem diferentes por hora. A
 * segunda tabela (mix de receita por procedimento) responde "de onde
 * vem o faturamento", pra decidir onde vale investir capacidade.
 */

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function ProfessionalRow({ item, rank, hasCostData }: { item: ProfessionalProfitabilityItem; rank: number; hasCostData: boolean }) {
  return (
    <tr className="border-b border-border-hairline last:border-0">
      <td className="whitespace-nowrap py-3 pl-4 pr-3 text-2xs font-semibold text-ink-faint">#{rank}</td>
      <td className="py-3 pr-3 text-sm text-ink">{item.full_name}</td>
      <td className="tabular whitespace-nowrap py-3 pr-3 text-right text-sm text-ink-muted">{formatCurrency(item.revenue)}</td>
      <td className="tabular whitespace-nowrap py-3 pr-3 text-right text-xs text-ink-muted">
        {(item.booked_minutes / 60).toFixed(1)}h ocupadas
      </td>
      <td className="tabular whitespace-nowrap py-3 pr-3 text-right text-sm font-semibold text-revenue">
        {item.revenue_per_hour !== null ? `${formatCurrency(item.revenue_per_hour)}/h` : "—"}
      </td>
      {hasCostData && (
        <td className="tabular whitespace-nowrap py-3 pl-3 pr-4 text-right text-sm font-semibold text-ink">
          {item.margin_per_hour !== null ? `${formatCurrency(item.margin_per_hour)}/h` : "—"}
        </td>
      )}
    </tr>
  );
}

/**
 * "Junta Técnica Insighta" (reavaliação de mercado da Sala de Comando):
 * "achamos benchmark externo pronto pra usar como régua dentro do
 * próprio painel [...] nenhuma dessas referências aparece hoje na
 * tela". Duas faixas de mercado (margem líquida saudável 15-30%; custo
 * fixo saudável até 60% da receita) contra o número REAL da clínica —
 * cada uma só aparece quando o backend calculou o valor (amostra
 * suficiente), nunca com um placeholder inventado. Um terceiro
 * benchmark do relatório (convênio paga 30-50% a menos que particular)
 * ficou de fora de propósito — ver DECISÃO em
 * AnalyticsService.get_profitability (backend): o produto não modela
 * uma cobrança genuinamente sem convênio hoje.
 */
function BenchmarkRow({
  label,
  value,
  healthyRangeLabel,
  isHealthy,
}: {
  label: string;
  value: string;
  healthyRangeLabel: string;
  isHealthy: boolean;
}) {
  const tone: BadgeTone = isHealthy ? "revenue" : "pending";
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-hairline py-2.5 last:border-0">
      <div>
        <p className="text-xs font-medium text-ink">{label}</p>
        <p className="text-2xs text-ink-faint">Faixa saudável de mercado: {healthyRangeLabel}</p>
      </div>
      <div className="flex items-center gap-2">
        <span className="tabular font-mono text-sm font-semibold text-ink">{value}</span>
        <Badge tone={tone}>{isHealthy ? "Dentro da faixa" : "Fora da faixa"}</Badge>
      </div>
    </div>
  );
}

function MarketBenchmarks({ data }: { data: Profitability }) {
  const rows: { key: string; label: string; value: string; healthyRangeLabel: string; isHealthy: boolean }[] = [];

  if (data.net_margin_pct !== null) {
    rows.push({
      key: "margin",
      label: "Margem líquida",
      value: `${data.net_margin_pct.toFixed(1)}%`,
      healthyRangeLabel: "15% a 30%",
      isHealthy: data.net_margin_pct >= 15 && data.net_margin_pct <= 30,
    });
  }
  if (data.fixed_cost_pct !== null) {
    rows.push({
      key: "fixed-cost",
      label: "Custo fixo sobre a receita",
      value: `${data.fixed_cost_pct.toFixed(1)}%`,
      healthyRangeLabel: "até 60%",
      isHealthy: data.fixed_cost_pct <= 60,
    });
  }
  if (rows.length === 0) return null;

  return (
    <BentoCard colSpan={12} noPadding>
      <p className="px-4 pt-4 text-sm font-medium text-ink">Como você está frente ao mercado</p>
      <p className="px-4 pb-1 text-2xs text-ink-faint">
        Referências de mercado (literatura de gestão hospitalar + pesquisa setorial), não medida interna do sistema.
      </p>
      <div className="px-4 pb-3">
        {rows.map((row) => (
          <BenchmarkRow key={row.key} label={row.label} value={row.value} healthyRangeLabel={row.healthyRangeLabel} isHealthy={row.isHealthy} />
        ))}
      </div>
    </BentoCard>
  );
}

function ProcedureRow({ item, rank }: { item: ProcedureProfitabilityItem; rank: number }) {
  return (
    <tr className="border-b border-border-hairline last:border-0">
      <td className="whitespace-nowrap py-3 pl-4 pr-3 text-2xs font-semibold text-ink-faint">#{rank}</td>
      <td className="py-3 pr-3">
        <p className="text-sm text-ink">{item.procedure_name ?? `Código TUSS ${item.procedure_code}`}</p>
        <p className="mt-0.5 text-xs text-ink-muted">{item.billing_count} faturamento{item.billing_count > 1 ? "s" : ""}</p>
      </td>
      <td className="tabular whitespace-nowrap py-3 pr-3 text-right text-sm text-ink">{formatCurrency(item.revenue)}</td>
      <td className="tabular whitespace-nowrap py-3 pl-3 pr-4 text-right text-sm font-semibold text-revenue">
        {item.share_pct.toFixed(0)}%
      </td>
    </tr>
  );
}

export function ProfitabilityPanel({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["analytics", "profitability", dateFrom, dateTo],
    queryFn: () =>
      apiClient.get<Profitability>(`/api/v1/analytics/profitability?date_from=${dateFrom}&date_to=${dateTo}`),
  });

  if (isLoading) return <LoadingState variant="cards" rows={4} />;
  if (error) return <ErrorState message={getApiErrorMessage(error)} />;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <p className="max-w-2xl text-xs text-ink-muted">
        Quem realmente traz receita, e de onde ela vem — além de faturamento total e taxa de glosa. Profissionais
        ordenados por receita gerada por hora de agenda OCUPADA (não por ocupação bruta); procedimentos ordenados
        por participação no faturamento do período.
      </p>

      {/* Épico F3.1 do Plano Diretor ("Módulo de custos e margem real"):
          sem NENHUM custo lançado ainda, a tela é honesta sobre isso em
          vez de fingir que "revenue_per_hour" já é margem — link direto
          pra onde resolver. */}
      {!data.has_cost_data && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-dashed border-border-subtle bg-canvas-raised/40 px-4 py-3 text-xs text-ink-muted">
          <span className="flex items-center gap-1.5">
            <Receipt size={13} className="shrink-0" />
            Isto é receita, não margem — nenhum custo (folha, repasse, aluguel, insumo) foi lançado ainda.
          </span>
          <Link to="/custos" className="whitespace-nowrap font-medium text-accent hover:underline">
            Lançar custos
          </Link>
        </div>
      )}
      {data.has_cost_data && data.net_margin !== null && (
        <div className="flex flex-wrap items-baseline gap-2 rounded-md border border-border-hairline bg-canvas-raised/40 px-4 py-3">
          <span className="text-xs text-ink-faint">Margem líquida do período</span>
          <span className={`font-mono text-lg font-semibold ${data.net_margin >= 0 ? "text-revenue" : "text-denied"}`}>
            {formatCurrency(data.net_margin)}
          </span>
          <span className="text-2xs text-ink-faint">
            ({formatCurrency(data.total_billed)} faturado − {formatCurrency(data.total_costs ?? 0)} de custo)
          </span>
        </div>
      )}

      <MarketBenchmarks data={data} />

      {data.by_professional.length === 0 ? (
        <EmptyState
          icon={<BadgeDollarSign size={17} strokeWidth={1.5} />}
          message="Nenhum faturamento vinculado a um profissional específico neste período."
        />
      ) : (
        <BentoCard colSpan={12} noPadding>
          <p className="px-4 pt-4 text-sm font-medium text-ink">Rentabilidade por profissional</p>
          <div className="overflow-x-auto" tabIndex={0}>
            <table className="w-full min-w-[560px] text-left">
              <thead>
                <tr className="border-b border-border-hairline text-2xs font-medium uppercase tracking-wide text-ink-faint">
                  <th className="py-3 pl-4 pr-3">#</th>
                  <th className="py-3 pr-3">Profissional</th>
                  <th className="py-3 pr-3 text-right">Receita</th>
                  <th className="py-3 pr-3 text-right">Agenda ocupada</th>
                  <th className={data.has_cost_data ? "py-3 pr-3 text-right" : "py-3 pl-3 pr-4 text-right"}>Receita/hora</th>
                  {data.has_cost_data && <th className="py-3 pl-3 pr-4 text-right">Margem/hora</th>}
                </tr>
              </thead>
              <tbody>
                {data.by_professional.map((item, idx) => (
                  <ProfessionalRow key={item.professional_id} item={item} rank={idx + 1} hasCostData={data.has_cost_data} />
                ))}
              </tbody>
            </table>
          </div>
        </BentoCard>
      )}

      {data.by_procedure.length > 0 && (
        <BentoCard colSpan={12} noPadding>
          <p className="px-4 pt-4 text-sm font-medium text-ink">Mix de receita por procedimento</p>
          <div className="overflow-x-auto" tabIndex={0}>
            <table className="w-full min-w-[480px] text-left">
              <thead>
                <tr className="border-b border-border-hairline text-2xs font-medium uppercase tracking-wide text-ink-faint">
                  <th className="py-3 pl-4 pr-3">#</th>
                  <th className="py-3 pr-3">Procedimento</th>
                  <th className="py-3 pr-3 text-right">Receita</th>
                  <th className="py-3 pl-3 pr-4 text-right">% do faturado</th>
                </tr>
              </thead>
              <tbody>
                {data.by_procedure.map((item, idx) => (
                  <ProcedureRow key={item.procedure_code} item={item} rank={idx + 1} />
                ))}
              </tbody>
            </table>
          </div>
        </BentoCard>
      )}
    </div>
  );
}
