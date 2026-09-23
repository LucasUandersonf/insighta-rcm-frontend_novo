import { useQuery } from "@tanstack/react-query";
import { PackageX } from "lucide-react";
import { BentoCard } from "@/components/ui/BentoGrid";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/Panel";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import type { UnbilledConsumption } from "@/lib/types";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(new Date(iso));
}

/**
 * "Nota 9" — lista por trás do alerta "material usado e não cobrado":
 * cada atendimento com saída de OPME/medicamento cuja conta não tem item
 * desse tipo. É o destino do botão do alerta — o gestor vê exatamente
 * quais contas completar antes de fechar o lote.
 */
export function UnbilledConsumptionPanel({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["analytics", "unbilled-consumption", dateFrom, dateTo],
    queryFn: () => apiClient.get<UnbilledConsumption>(`/api/v1/analytics/unbilled-consumption?date_from=${dateFrom}&date_to=${dateTo}`),
  });

  if (isLoading) return <LoadingState variant="cards" rows={2} />;
  if (error) return <ErrorState message={getApiErrorMessage(error)} />;
  if (!data) return null;

  if (data.items.length === 0) {
    return (
      <BentoCard colSpan={12}>
        <EmptyState
          icon={<PackageX size={17} strokeWidth={1.5} />}
          message="Nenhum material especial ou medicamento usado sem cobrança neste período."
        />
      </BentoCard>
    );
  }

  return (
    <BentoCard colSpan={12} noPadding>
      <div className="px-4 pt-4">
        <p className="text-sm font-medium text-ink">Material usado e não cobrado</p>
        <p className="mt-1 max-w-2xl text-xs text-ink-muted">
          Atendimentos com saída de OPME ou medicamento que não aparece na conta do paciente — {formatCurrency(data.total_cost)} só de
          custo. Lance o item antes de fechar o lote.
        </p>
      </div>
      <div className="overflow-x-auto" tabIndex={0}>
        <table className="w-full min-w-[640px] text-left">
          <thead>
            <tr className="border-b border-border-hairline text-2xs font-medium uppercase tracking-wide text-ink-faint">
              <th className="py-3 pl-4 pr-3">Data</th>
              <th className="py-3 pr-3">Paciente</th>
              <th className="py-3 pr-3">Profissional</th>
              <th className="py-3 pr-3">Material</th>
              <th className="py-3 pl-3 pr-4 text-right">Custo</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => (
              <tr key={item.appointment_id} className="border-b border-border-hairline last:border-0">
                <td className="tabular whitespace-nowrap py-3 pl-4 pr-3 text-sm text-ink-muted">{formatDate(item.scheduled_at)}</td>
                <td className="py-3 pr-3 text-sm text-ink">{item.patient_name ?? "—"}</td>
                <td className="py-3 pr-3 text-sm text-ink-muted">{item.professional_name ?? "—"}</td>
                <td className="py-3 pr-3 text-sm text-ink-muted">{item.materials}</td>
                <td className="tabular whitespace-nowrap py-3 pl-3 pr-4 text-right text-sm font-semibold text-ink">
                  {formatCurrency(item.cost)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </BentoCard>
  );
}
