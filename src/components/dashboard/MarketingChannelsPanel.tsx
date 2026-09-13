import { useQuery } from "@tanstack/react-query";
import { Megaphone } from "lucide-react";
import { BentoCard } from "@/components/ui/BentoGrid";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/Panel";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import type { MarketingChannelItem, MarketingChannels } from "@/lib/types";

/**
 * Raio-X da Receita, frente "Gestão eficiente" — ROI de marketing
 * existia só AGREGADO até esta rodada (gasto total vs. receita total
 * atribuída, ver relatório semanal e o insight "O marketing está
 * gastando mais do que está trazendo de volta"). Esta tabela abre por
 * campanha/canal: CAC (gasto do período / pacientes novos atribuídos no
 * período) e receita média por paciente — proxy de LTV, usando o
 * histórico TOTAL desses pacientes, não só o período — um canal ótimo
 * escondido atrás de um ruim finalmente aparece.
 */

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function ChannelRow({ item, rank }: { item: MarketingChannelItem; rank: number }) {
  return (
    <tr className="border-b border-border-hairline last:border-0">
      <td className="whitespace-nowrap py-3 pl-4 pr-3 text-2xs font-semibold text-ink-faint">#{rank}</td>
      <td className="py-3 pr-3">
        <p className="text-sm text-ink">{item.campaign_name ?? item.campaign_id}</p>
        <p className="mt-0.5 text-xs text-ink-muted">{item.source}</p>
      </td>
      <td className="tabular whitespace-nowrap py-3 pr-3 text-right text-sm text-ink-muted">{formatCurrency(item.spend)}</td>
      <td className="tabular whitespace-nowrap py-3 pr-3 text-right text-xs text-ink-muted">
        {item.patients_acquired} paciente{item.patients_acquired !== 1 ? "s" : ""}
      </td>
      <td className="tabular whitespace-nowrap py-3 pr-3 text-right text-sm text-ink">
        {item.cac !== null ? formatCurrency(item.cac) : "—"}
      </td>
      <td className="tabular whitespace-nowrap py-3 pl-3 pr-4 text-right text-sm font-semibold text-revenue">
        {item.avg_revenue_per_patient !== null ? formatCurrency(item.avg_revenue_per_patient) : "—"}
      </td>
    </tr>
  );
}

export function MarketingChannelsPanel({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["analytics", "marketing-channels", dateFrom, dateTo],
    queryFn: () =>
      apiClient.get<MarketingChannels>(`/api/v1/analytics/marketing-channels?date_from=${dateFrom}&date_to=${dateTo}`),
  });

  if (isLoading) return <LoadingState variant="cards" rows={3} />;
  if (error) return <ErrorState message={getApiErrorMessage(error)} />;
  if (!data) return null;

  if (data.items.length === 0) {
    return (
      <BentoCard colSpan={12}>
        <EmptyState
          icon={<Megaphone size={17} strokeWidth={1.5} />}
          message="Nenhum gasto de marketing registrado neste período."
        />
      </BentoCard>
    );
  }

  return (
    <BentoCard colSpan={12} noPadding>
      <div className="px-4 pt-4">
        <p className="text-sm font-medium text-ink">Aquisição por canal</p>
        <p className="mt-1 max-w-2xl text-xs text-ink-muted">
          CAC (custo por paciente novo) usa o gasto e os pacientes adquiridos NESTE período; receita média por
          paciente usa o histórico completo de cada um — quanto cada paciente trazido por essa campanha já valeu
          até hoje, não só o que gerou nesta janela.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-left">
          <thead>
            <tr className="border-b border-border-hairline text-2xs font-medium uppercase tracking-wide text-ink-faint">
              <th className="py-3 pl-4 pr-3">#</th>
              <th className="py-3 pr-3">Campanha</th>
              <th className="py-3 pr-3 text-right">Gasto</th>
              <th className="py-3 pr-3 text-right">Adquiridos</th>
              <th className="py-3 pr-3 text-right">CAC</th>
              <th className="py-3 pl-3 pr-4 text-right">Receita média/paciente</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item, idx) => (
              <ChannelRow key={`${item.source}-${item.campaign_id}`} item={item} rank={idx + 1} />
            ))}
          </tbody>
        </table>
      </div>
    </BentoCard>
  );
}
