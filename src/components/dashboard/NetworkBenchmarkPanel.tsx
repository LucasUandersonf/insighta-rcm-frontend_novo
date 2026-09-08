import { useQuery } from "@tanstack/react-query";
import { BentoCard } from "@/components/ui/BentoGrid";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/Panel";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import type { NetworkBenchmark, NetworkBenchmarkMetric } from "@/lib/types";
import { Users } from "lucide-react";

/**
 * Comparativo entre clínicas — Sala de Comando 2.0, Nível 1 do roadmap
 * ("só existe em escala"): sua taxa contra a MEDIANA agregada de outras
 * clínicas ativas na base, nunca uma clínica específica (ver DECISÃO
 * completa em app/sql/032_network_benchmark.sql, backend). Aba própria
 * (não cabe no feed de insights) porque mostra o comparativo completo
 * por indicador, não só "o pior desvio da semana".
 */

function BenchmarkBar({ metric }: { metric: NetworkBenchmarkMetric }) {
  const hasNetwork = metric.network_median !== null;
  const yourPct = metric.your_rate !== null ? metric.your_rate * 100 : null;
  const networkPct = metric.network_median !== null ? metric.network_median * 100 : null;
  // Escala do desenho: maior dos dois valores + margem, nunca menor que 10pp
  // (evita uma barra minúscula quando as duas taxas são bem baixas).
  const maxScale = Math.max(yourPct ?? 0, networkPct ?? 0, 10) * 1.25;
  const yourWidth = yourPct !== null ? Math.min(100, (yourPct / maxScale) * 100) : 0;
  const networkLeft = networkPct !== null ? Math.min(100, (networkPct / maxScale) * 100) : null;

  const diff = hasNetwork && yourPct !== null && networkPct !== null ? yourPct - networkPct : null;
  const diffLabel =
    diff === null ? null : diff > 0.05 ? `+${diff.toFixed(1)}pp acima da mediana` : diff < -0.05 ? `${diff.toFixed(1)}pp abaixo da mediana` : "na mediana da rede";

  return (
    <BentoCard colSpan={12} className="mb-3">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-ink">{metric.label}</span>
        {diffLabel && (
          <span className={diff !== null && diff > 0 ? "text-xs font-medium text-pending" : "text-xs font-medium text-revenue"}>
            {diffLabel}
          </span>
        )}
      </div>
      <div className="relative h-7 overflow-hidden rounded-md bg-canvas-raised/50">
        {yourPct !== null && (
          <div
            className="flex h-full items-center rounded-md bg-gradient-to-r from-accent to-[hsl(271_70%_60%)] px-2.5 text-2xs font-semibold text-white"
            style={{ width: `${Math.max(yourWidth, 14)}%` }}
          >
            Você — {yourPct.toFixed(1)}%
          </div>
        )}
        {networkLeft !== null && (
          <div className="absolute -top-1 bottom-0 w-0.5 bg-ink-faint" style={{ left: `${networkLeft}%` }}>
            <span className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-2xs text-ink-faint">
              Mediana {networkPct?.toFixed(1)}%
            </span>
          </div>
        )}
      </div>
      {!hasNetwork && (
        <p className="mt-2 text-2xs text-ink-faint">
          Ainda não há clínicas suficientes na base para calcular a mediana da rede com segurança
          {metric.cohort_size > 0 ? ` (${metric.cohort_size} até agora)` : ""} — volta a aparecer assim que a base crescer.
        </p>
      )}
    </BentoCard>
  );
}

export function NetworkBenchmarkPanel() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["analytics", "network-benchmark"],
    queryFn: () => apiClient.get<NetworkBenchmark>("/api/v1/analytics/network-benchmark"),
  });

  if (isLoading) return <LoadingState variant="cards" rows={3} />;
  if (error) return <ErrorState message={getApiErrorMessage(error)} />;
  if (!data) return null;

  return (
    <div>
      <p className="mb-4 max-w-2xl text-xs text-ink-muted">
        Sua clínica contra a mediana agregada de outras clínicas ativas na base Insighta — nunca o dado de uma clínica
        específica, e só quando há clínicas suficientes para comparar com segurança.
      </p>
      {data.metrics.length === 0 ? (
        <EmptyState icon={<Users size={17} strokeWidth={1.5} />} message="Nenhuma métrica disponível ainda." />
      ) : (
        data.metrics.map((m) => <BenchmarkBar key={m.key} metric={m} />)
      )}
    </div>
  );
}
