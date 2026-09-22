import { useQuery } from "@tanstack/react-query";
import { PieChart } from "lucide-react";
import { BentoCard } from "@/components/ui/BentoGrid";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/Panel";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import type { AbcCurve, AbcCurveItem } from "@/lib/types";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

const CLASSE_TONE: Record<AbcCurveItem["classe"], BadgeTone> = {
  A: "revenue",
  B: "pending",
  C: "neutral",
};

/**
 * Achado do Comitê de Liderança Tecnológica ("5 pernas", aba Estoque
 * dedicada) — curva ABC de farmácia: materiais ordenados pelo valor de
 * CONSUMO no período (não saldo em estoque), com classe A/B/C pela
 * regra clássica 80/15/5 de % acumulado (ver DECISÃO completa em
 * MaterialRepository.consumption_abc_curve, backend). "A" são os
 * poucos itens que respondem pela maior fatia do gasto — é neles que
 * negociar preço com fornecedor ou apertar controle de perda rende mais.
 */
export function AbcCurvePanel({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["analytics", "estoque-abc-curve", dateFrom, dateTo],
    queryFn: () => apiClient.get<AbcCurve>(`/api/v1/analytics/estoque-abc-curve?date_from=${dateFrom}&date_to=${dateTo}`),
  });

  if (isLoading) return <LoadingState variant="cards" rows={3} />;
  if (error) return <ErrorState message={getApiErrorMessage(error)} />;
  if (!data) return null;

  if (data.items.length === 0) {
    return (
      <BentoCard colSpan={12}>
        <EmptyState icon={<PieChart size={17} strokeWidth={1.5} />} message="Nenhum consumo de material registrado neste período para montar a curva ABC." />
      </BentoCard>
    );
  }

  const totalValue = data.items.reduce((sum, item) => sum + item.valor_consumido, 0);
  const countByClasse = { A: 0, B: 0, C: 0 };
  for (const item of data.items) countByClasse[item.classe] += 1;

  return (
    <BentoCard colSpan={12} noPadding>
      <div className="px-4 pt-4">
        <p className="text-sm font-medium text-ink">Curva ABC de farmácia</p>
        <p className="mt-1 max-w-2xl text-xs text-ink-muted">
          {data.items.length} materiais consumidos no período, somando {formatCurrency(totalValue)} — {countByClasse.A} classe A (a fatia que mais pesa no custo),{" "}
          {countByClasse.B} classe B, {countByClasse.C} classe C.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left">
          <thead>
            <tr className="border-b border-border-hairline text-2xs font-medium uppercase tracking-wide text-ink-faint">
              <th className="py-3 pl-4 pr-3">#</th>
              <th className="py-3 pr-3">Material</th>
              <th className="py-3 pr-3 text-right">Valor consumido</th>
              <th className="py-3 pl-3 pr-4 text-right">Classe</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item, idx) => (
              <tr key={item.material_id} className="border-b border-border-hairline last:border-0">
                <td className="whitespace-nowrap py-3 pl-4 pr-3 text-2xs font-semibold text-ink-faint">#{idx + 1}</td>
                <td className="py-3 pr-3 text-sm text-ink">{item.nome}</td>
                <td className="tabular whitespace-nowrap py-3 pr-3 text-right text-sm text-ink-muted">{formatCurrency(item.valor_consumido)}</td>
                <td className="whitespace-nowrap py-3 pl-3 pr-4 text-right">
                  <Badge tone={CLASSE_TONE[item.classe]}>{item.classe}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </BentoCard>
  );
}
