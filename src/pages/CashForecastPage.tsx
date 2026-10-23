import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Panel, EmptyState, LoadingState, ErrorState } from "@/components/ui/Panel";
import { PageHeader } from "@/components/ui/PageHeader";
import { brl, percent } from "@/components/money/PreSubmissionIssues";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { formatDateBR } from "@/lib/dates";
import type { CashForecast, CashPlan } from "@/lib/types";

const LAG_SOURCE: Record<CashPlan["lag_source"], string> = {
  historico: "histórico do convênio",
  clinica: "média da clínica",
  padrao: "padrão (sem histórico)",
};

function ddmm(iso: string): string {
  return formatDateBR(iso, { day: "2-digit", month: "2-digit" });
}

/**
 * Caixa das próximas 13 semanas: quanto deve entrar em cada semana, pelo
 * que a clínica já tem a receber (prazo real de cada convênio e recusa
 * esperada). Ao lado, o que entrou de fato nas últimas 8 semanas.
 */
export function CashForecastPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["financeiro", "caixa-13-semanas"],
    queryFn: () => apiClient.get<CashForecast>("/api/v1/financeiro/caixa-13-semanas"),
  });

  const max = data ? Math.max(1, ...data.weeks.map((w) => w.gross), ...data.history.map((h) => h.received)) : 1;
  const avgHistory = data && data.history.length ? data.history.reduce((s, h) => s + h.received, 0) / data.history.length : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Caixa das próximas 13 semanas"
        subtitle="Quanto deve entrar em cada semana pelo que a clínica já tem a receber, descontada a glosa esperada de cada convênio."
      />
      {isLoading && <LoadingState />}
      {error && <ErrorState message={getApiErrorMessage(error)} />}
      {data && data.open_gross === 0 && (
        <Panel>
          <EmptyState message="Nenhuma conta em aberto. Quando o faturamento chegar pela integração, a previsão aparece aqui." />
        </Panel>
      )}
      {data && data.open_gross > 0 && (
        <>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-border-hairline bg-glass px-4 py-3">
              <dt className="text-xs text-ink-faint">Deve entrar em 13 semanas</dt>
              <dd className="text-lg font-semibold tabular text-revenue">{brl(data.expected_net)}</dd>
              <dd className="text-2xs text-ink-faint">
                já descontados {brl(data.expected_denial)} de glosa esperada
                {data.expected_withholding ? ` e ${brl(data.expected_withholding)} de impostos retidos` : ""}
              </dd>
            </div>
            <div className="rounded-lg border border-border-hairline bg-glass px-4 py-3">
              <dt className="text-xs text-ink-faint">Atrasado no convênio</dt>
              <dd className="text-lg font-semibold tabular text-denied">{brl(data.overdue_submitted)}</dd>
              <dd className="text-2xs">
                <Link to="/recuperacao" className="text-accent underline">
                  Cobrar na Central de Recuperação
                </Link>
              </dd>
            </div>
            <div className="rounded-lg border border-border-hairline bg-glass px-4 py-3">
              <dt className="text-xs text-ink-faint">Parado na clínica, sem envio</dt>
              <dd className="text-lg font-semibold tabular text-pending">{brl(data.overdue_unsent)}</dd>
              <dd className="text-2xs">
                <Link to="/conferencia-envio" className="text-accent underline">
                  Conferir e enviar
                </Link>
              </dd>
            </div>
            <div className="rounded-lg border border-border-hairline bg-glass px-4 py-3">
              <dt className="text-xs text-ink-faint">Média recebida por semana</dt>
              <dd className="text-lg font-semibold tabular text-ink">{brl(avgHistory)}</dd>
              <dd className="text-2xs text-ink-faint">últimas 8 semanas</dd>
            </div>
          </dl>

          <Panel
            title="Semana a semana"
            subtitle="Barra cheia: o que deve entrar. Parte clara: a glosa esperada. Em cinza, o que entrou de fato nas últimas semanas."
            help="Data esperada = vencimento enviado pelo ERP ou data da conta + prazo médio real de pagamento do convênio (últimos 12 meses). Valor = cobrado × (1 − taxa real de recusa do convênio, últimos 6 meses)."
          >
            <ol
              className="flex h-48 items-end gap-1 overflow-x-auto pb-1"
              aria-label="Recebido nas últimas semanas e previsto nas próximas"
            >
              {data.history.map((h) => (
                <li key={`h-${h.start}`} className="flex h-full min-w-[28px] flex-1 flex-col items-center justify-end gap-1">
                  <span
                    className="w-full rounded-t bg-ink-faint/30"
                    style={{ height: `${(h.received / max) * 100}%` }}
                    title={`Semana de ${ddmm(h.start)}: entrou ${brl(h.received)}`}
                  />
                  <span className="text-2xs text-ink-faint">{ddmm(h.start)}</span>
                </li>
              ))}
              {data.weeks.map((w) => (
                <li key={w.start} className="flex h-full min-w-[28px] flex-1 flex-col items-center justify-end gap-1">
                  <span className="flex w-full flex-col justify-end" style={{ height: `${(w.gross / max) * 100}%` }}>
                    <span
                      className="w-full rounded-t bg-revenue/30"
                      style={{
                        height: `${w.gross ? ((w.gross - w.net) / w.gross) * 100 : 0}%`,
                      }}
                    />
                    <span
                      className="w-full bg-revenue"
                      style={{
                        height: `${w.gross ? (w.net / w.gross) * 100 : 0}%`,
                      }}
                      title={`Semana de ${ddmm(w.start)}: deve entrar ${brl(w.net)}`}
                    />
                  </span>
                  <span className="text-2xs text-ink-muted">{ddmm(w.start)}</span>
                </li>
              ))}
            </ol>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-ink-faint">
                  <tr>
                    <th className="py-1 pr-3 font-medium">Semana</th>
                    <th className="py-1 pr-3 text-right font-medium">Deve entrar</th>
                    <th className="py-1 pr-3 text-right font-medium">Glosa esperada</th>
                    <th className="py-1 pr-3 text-right font-medium">Contas</th>
                    <th className="py-1 font-medium">Principais convênios</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-hairline">
                  {data.weeks.map((w) => (
                    <tr key={w.start}>
                      <td className="py-1 pr-3 tabular">
                        {ddmm(w.start)} a {ddmm(w.end)}
                      </td>
                      <td className="py-1 pr-3 text-right tabular font-medium">{brl(w.net)}</td>
                      <td className="py-1 pr-3 text-right tabular text-ink-muted">{brl(w.gross - w.net)}</td>
                      <td className="py-1 pr-3 text-right tabular">{w.count}</td>
                      <td className="py-1 text-xs text-ink-muted">{w.top_plans.map(([name]) => name).join(", ") || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.later > 0 && (
                <p className="mt-2 text-xs text-ink-faint">Depois de 13 semanas: {brl(data.later)} (vencimentos mais longos).</p>
              )}
            </div>
          </Panel>

          <Panel title="Prazo e glosa por convênio" subtitle="De onde vêm os números da previsão.">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-ink-faint">
                  <tr>
                    <th className="py-1 pr-3 font-medium">Convênio</th>
                    <th className="py-1 pr-3 text-right font-medium">A receber</th>
                    <th className="py-1 pr-3 text-right font-medium">Atrasado</th>
                    <th className="py-1 pr-3 text-right font-medium">Prazo médio</th>
                    <th className="py-1 text-right font-medium">Glosa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-hairline">
                  {data.plans.map((p) => (
                    <tr key={p.plan_name}>
                      <td className="py-1 pr-3">{p.plan_name}</td>
                      <td className="py-1 pr-3 text-right tabular">{brl(p.open_gross)}</td>
                      <td className={"py-1 pr-3 text-right tabular " + (p.overdue ? "text-denied" : "")}>{brl(p.overdue)}</td>
                      <td className="py-1 pr-3 text-right tabular" title={LAG_SOURCE[p.lag_source]}>
                        {p.lag_days} dias
                        {p.lag_source !== "historico" && (
                          <span className="text-2xs text-ink-faint"> ({LAG_SOURCE[p.lag_source]})</span>
                        )}
                      </td>
                      <td className="py-1 text-right tabular">{percent(p.denial_rate)}</td>
                    </tr>
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
