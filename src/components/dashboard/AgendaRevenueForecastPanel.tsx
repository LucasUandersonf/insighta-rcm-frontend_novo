import { useQuery } from "@tanstack/react-query";
import { BentoCard } from "@/components/ui/BentoGrid";
import { LoadingState, ErrorState } from "@/components/ui/Panel";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import type { AgendaRevenueForecast } from "@/lib/types";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatPeriod(startIso: string, endIso: string): string {
  const fmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });
  return `${fmt.format(new Date(`${startIso}T00:00:00`))} a ${fmt.format(new Date(`${endIso}T00:00:00`))}`;
}

/**
 * "Previsão de receita — agenda futura" — pedido direto do usuário: "a
 * receita da agenda... conseguimos tirar metade do faturamento futuro
 * da clínica". Sem `dateFrom`/`dateTo` de propósito: diferente de todo
 * o resto da Sala de Comando (que olha pra trás, dentro do período
 * filtrado), esta é a ÚNICA previsão que olha pra FRENTE — usa sempre o
 * default do backend (hoje + 13 dias, ver `_default_future_period` no
 * endpoint), independente do seletor de período da tela.
 *
 * DECISÃO — 3 números lado a lado, nunca um só: mesmo raciocínio de
 * AgendaRevenueForecastResponse (backend) — somar tudo num "valor
 * esperado" único esconderia exatamente a incerteza que o resto do
 * produto já se recusa a esconder (ver docstring do schema). "Receita
 * esperada" (ajustada por risco de falta) é o número em destaque porque
 * é o mais confiável dos três; "sem histórico ainda" e "sem preço de
 * contrato" aparecem como contexto, não como parte da mesma soma.
 */
export function AgendaRevenueForecastPanel() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["analytics", "agenda-revenue-forecast"],
    queryFn: () => apiClient.get<AgendaRevenueForecast>("/api/v1/analytics/agenda-revenue-forecast"),
  });

  return (
    <BentoCard colSpan={4}>
      <p className="mb-1 text-2xs font-medium text-ink-muted">Previsão de receita — agenda futura</p>
      {isLoading && <LoadingState rows={3} />}
      {error && <ErrorState message={getApiErrorMessage(error)} />}
      {data && (
        <>
          <p className="mb-3.5 text-2xs text-ink-faint">{formatPeriod(data.period_start, data.period_end)}</p>
          {data.total_scheduled_count === 0 ? (
            <p className="py-2 text-xs text-ink-faint">Nenhum agendamento futuro nesse período ainda.</p>
          ) : (
            <div className="space-y-3.5">
              <div>
                <p className="tabular text-2xl font-semibold tracking-tightest text-revenue">
                  {formatCurrency(data.expected_value)}
                </p>
                <p className="text-2xs leading-relaxed text-ink-muted">
                  Receita esperada, já ajustada pelo risco de falta de {data.known_risk_count}{" "}
                  {data.known_risk_count === 1 ? "agendamento" : "agendamentos"} com histórico calculado.
                </p>
              </div>
              {data.unrated_count > 0 && (
                <div className="border-t border-border-hairline pt-3">
                  <p className="tabular text-sm font-medium text-ink">{formatCurrency(data.unrated_value)}</p>
                  <p className="text-2xs leading-relaxed text-ink-faint">
                    Em {data.unrated_count} {data.unrated_count === 1 ? "agendamento" : "agendamentos"} de{" "}
                    {data.unrated_count === 1 ? "paciente" : "pacientes"} sem histórico ainda — fora do ajuste de
                    risco, ainda não dá pra saber a chance de falta.
                  </p>
                </div>
              )}
              {data.unpriced_count > 0 && (
                <div className="border-t border-border-hairline pt-3">
                  <p className="text-2xs leading-relaxed text-ink-faint">
                    {data.unpriced_count} {data.unpriced_count === 1 ? "agendamento" : "agendamentos"} sem preço de
                    contrato encontrado ainda — fora desta conta.
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </BentoCard>
  );
}
