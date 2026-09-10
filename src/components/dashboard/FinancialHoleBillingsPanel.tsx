import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { FileWarning } from "lucide-react";
import { BentoCard } from "@/components/ui/BentoGrid";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import type { FinancialHoleBillingItem, FinancialHoleBillings } from "@/lib/types";

/**
 * Contas reais por trás do insight "Você está cobrando menos do que
 * devia de alguns convênios" (ver DECISÃO em
 * smart_insights_engine.py::_financial_hole_insight) — achado do
 * usuário: o card só dizia QUANTO no total, nunca QUAIS contas
 * corrigir. Destino de `#buraco-financeiro`. A correção em si (ajustar
 * a tabela de preços) continua em Contratos — este painel é onde
 * enxergar o problema linha a linha, não onde editar o contrato.
 */

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function FinancialHoleRow({ item }: { item: FinancialHoleBillingItem }) {
  return (
    <tr className="border-b border-border-hairline last:border-0">
      <td className="py-3 pl-4 pr-3 text-sm text-ink">{item.patient_full_name}</td>
      <td className="py-3 pr-3">
        <p className="text-sm text-ink">{item.procedure_label}</p>
        <p className="mt-0.5 text-xs text-ink-muted">{item.insurance_plan_name}</p>
      </td>
      <td className="tabular whitespace-nowrap py-3 pr-3 text-right text-sm text-ink-muted">{formatCurrency(item.charged_value)}</td>
      <td className="tabular whitespace-nowrap py-3 pr-3 text-right text-sm text-ink">{formatCurrency(item.agreed_price)}</td>
      <td className="tabular whitespace-nowrap py-3 pl-3 pr-4 text-right text-sm font-medium text-pending">
        -{formatCurrency(item.hole_value)}
      </td>
    </tr>
  );
}

export function FinancialHoleBillingsPanel({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery({
    queryKey: ["analytics", "financial-hole-billings", dateFrom, dateTo],
    queryFn: () =>
      apiClient.get<FinancialHoleBillings>(`/api/v1/analytics/financial-hole-billings?date_from=${dateFrom}&date_to=${dateTo}`),
  });

  if (isLoading) return <LoadingState variant="cards" rows={4} />;
  if (error) return <ErrorState message={getApiErrorMessage(error)} />;
  if (!data) return null;

  if (data.total_count === 0) {
    return (
      <BentoCard colSpan={12}>
        <EmptyState
          icon={<FileWarning size={17} strokeWidth={1.5} />}
          message="Nenhuma conta cobrada abaixo do contratado nesse período — sua tabela de preços está batendo com o que foi cobrado."
        />
      </BentoCard>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-xs text-ink-muted">
          {data.total_count} conta{data.total_count > 1 ? "s" : ""} nesse período{" "}
          {data.total_count > 1 ? "saíram" : "saiu"} abaixo do combinado no contrato, somando{" "}
          <span className="font-medium text-pending">{formatCurrency(data.total_hole_value)}</span> que nem chegou a
          ser pedido — pior caso primeiro. A correção é sempre na tabela de preços de Contratos, não nesta conta já
          emitida.
        </p>
        <Button type="button" variant="secondary" size="sm" onClick={() => navigate("/contracts")} className="shrink-0">
          Ir para Contratos
        </Button>
      </div>

      <BentoCard colSpan={12} noPadding>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left">
            <thead>
              <tr className="border-b border-border-hairline text-2xs font-medium uppercase tracking-wide text-ink-faint">
                <th className="py-3 pl-4 pr-3">Paciente</th>
                <th className="py-3 pr-3">Procedimento / Convênio</th>
                <th className="py-3 pr-3 text-right">Valor cobrado</th>
                <th className="py-3 pr-3 text-right">Valor contratado</th>
                <th className="py-3 pl-3 pr-4 text-right">Diferença</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <FinancialHoleRow key={item.billing_id} item={item} />
              ))}
            </tbody>
          </table>
        </div>
      </BentoCard>

      {data.total_count > data.items.length && (
        <p className="text-2xs text-ink-faint">
          Mostrando as {data.items.length} piores diferenças de {data.total_count} no total.
        </p>
      )}
    </div>
  );
}
