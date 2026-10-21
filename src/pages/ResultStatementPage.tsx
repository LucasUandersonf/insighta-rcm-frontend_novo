import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Download, TrendingUp } from "lucide-react";
import { Panel, EmptyState, LoadingState, ErrorState } from "@/components/ui/Panel";
import { PageHeader } from "@/components/ui/PageHeader";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import type { ResultStatement } from "@/lib/types";

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return `${MONTHS[month - 1]} de ${year}`;
}

/** Últimos 12 meses, do atual para trás, no formato AAAA-MM. */
export function recentMonths(today = new Date(), count = 12): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

async function downloadPdf(path: string, fileName: string) {
  const blob = await apiClient.getBlob(path);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Extrato de Resultado: quanto o Insighta rendeu para a clínica no mês.
 * Só entra o que foi medido (salvo antes do envio, recurso deferido,
 * insight resolvido com ganho conferido na reavaliação), cada linha com a
 * regra de cálculo. O mesmo extrato sai em PDF no dia 1 para os
 * destinatários do relatório semanal.
 */
export function ResultStatementPage() {
  const months = useMemo(() => recentMonths(), []);
  const [month, setMonth] = useState(months[0]);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["analytics", "result-statement", month],
    queryFn: () => apiClient.get<ResultStatement>(`/api/v1/analytics/result-statement?month=${month}`),
  });

  // Extrato (o que o Insighta rendeu) ou Board Pack (o mês da clínica para os sócios).
  async function handleDownload(kind: "extrato" | "board") {
    setDownloading(true);
    setDownloadError(null);
    try {
      if (kind === "extrato") {
        await downloadPdf(`/api/v1/analytics/result-statement/pdf?month=${month}`, `extrato_resultado_${month}.pdf`);
      } else {
        await downloadPdf(`/api/v1/analytics/board-pack/pdf?month=${month}`, `board_pack_${month}.pdf`);
      }
    } catch (err) {
      setDownloadError(getApiErrorMessage(err));
    } finally {
      setDownloading(false);
    }
  }

  const diff = data ? data.total_value - data.previous_month_total : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={TrendingUp}
        title="Extrato de Resultado"
        subtitle="Quanto o Insighta rendeu para a clínica no mês. Só entram valores medidos."
        action={
          <div className="flex items-center gap-2">
            <label htmlFor="extrato-mes" className="sr-only">
              Mês
            </label>
            <select
              id="extrato-mes"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="h-[38px] rounded-[11px] border border-border-hairline bg-canvas-raised/40 px-3 text-sm text-ink"
            >
              {months.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void handleDownload("extrato")}
              disabled={downloading || !data}
              className="flex h-[38px] items-center gap-2 rounded-[11px] border border-border-hairline bg-canvas-raised/40 px-3 text-sm text-ink transition-colors hover:bg-canvas-raised/70 disabled:opacity-50"
            >
              <Download aria-hidden size={15} />
              {downloading ? "Gerando PDF…" : "Baixar PDF"}
            </button>
            <button
              type="button"
              onClick={() => void handleDownload("board")}
              disabled={downloading}
              title="O mês da clínica para a reunião de sócios: números, 3 riscos, 3 oportunidades, decisões e caixa."
              className="flex h-[38px] items-center gap-2 rounded-[11px] border border-border-hairline bg-canvas-raised/40 px-3 text-sm text-ink transition-colors hover:bg-canvas-raised/70 disabled:opacity-50"
            >
              <Download aria-hidden size={15} />
              Board Pack
            </button>
          </div>
        }
      />

      {downloadError && <ErrorState message={downloadError} />}
      {isLoading && <LoadingState variant="cards" rows={3} />}
      {error && <ErrorState message={getApiErrorMessage(error)} />}

      {data && (
        <>
          <section aria-labelledby="extrato-total" className="rounded-[20px] border border-revenue/25 bg-revenue/[0.06] p-6">
            <p id="extrato-total" className="text-sm text-ink-muted">
              Valor gerado em {monthLabel(data.month)}
              {data.is_partial && " (mês em andamento)"}
            </p>
            <p className="tabular mt-1 text-[40px] font-semibold tracking-[-0.02em] text-revenue">{formatCurrency(data.total_value)}</p>
            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink-soft">
              {data.return_multiple !== null && data.plan_price !== null && (
                <span>
                  <strong className="text-ink">{data.return_multiple.toLocaleString("pt-BR")}×</strong>{" "}
                  {data.plan_price_source === "assinatura" ? "o valor do plano" : "o preço Founders (referência)"} de {formatCurrency(data.plan_price)}/mês
                </span>
              )}
              <span>
                Mês anterior: {formatCurrency(data.previous_month_total)}
                {data.previous_month_total > 0 && diff !== 0 && (
                  <span className={diff > 0 ? "text-revenue" : "text-denied"}> ({diff > 0 ? "+" : "−"}{formatCurrency(Math.abs(diff))})</span>
                )}
              </span>
              <span>Acumulado desde o início: {formatCurrency(data.cumulative_total)}</span>
            </div>
          </section>

          <section aria-labelledby="extrato-composicao" className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <h2 id="extrato-composicao" className="sr-only">
              Composição
            </h2>
            {data.components.map((c) => (
              <div key={c.key} className="flex flex-col gap-2 rounded-[18px] border border-border-hairline bg-glass p-5">
                <span className="text-[13px] text-ink-muted">{c.label}</span>
                <span className="tabular text-2xl font-semibold text-ink">{formatCurrency(c.value)}</span>
                <span className="text-xs text-ink-faint">
                  {c.count} {c.count === 1 ? "item" : "itens"}
                </span>
                <details className="text-xs text-ink-muted">
                  <summary className="cursor-pointer font-medium text-accent-muted">Como calculamos</summary>
                  <p className="mt-1.5 leading-relaxed">{c.how}</p>
                </details>
              </div>
            ))}
          </section>

          <Panel title="Principais itens do mês">
            {data.items.length === 0 ? (
              <EmptyState
                icon={<TrendingUp size={17} strokeWidth={1.5} />}
                message="Nenhum resultado medido neste mês ainda. No primeiro mês isso é normal: o Extrato precisa do faturamento importado e do primeiro retorno do convênio (pagamento ou glosa) para medir. Enquanto isso, corrija as guias retidas na Fila de correção e resolva os insights da Sala de Comando: o ganho aparece aqui depois da reavaliação."
              />
            ) : (
              <ul className="divide-y divide-border-hairline px-6">
                {data.items.map((item, index) => (
                  <li key={`${item.kind}-${index}`} className="flex items-start gap-4 py-3">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-sm text-ink">{item.title}</span>
                      {item.detail && <span className="text-xs text-ink-faint">{item.detail}</span>}
                    </div>
                    <span className="tabular ml-auto shrink-0 text-sm font-semibold text-revenue">{formatCurrency(item.value)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <p className="text-xs leading-relaxed text-ink-faint">
            O extrato do mês fechado é enviado em PDF todo dia 1 para os{" "}
            <Link to="/admin/destinatarios" className="text-accent-muted hover:underline">
              destinatários do relatório semanal
            </Link>
            . Falta evitada e paciente que voltou entram quando o insight correspondente é resolvido e reavaliado.
          </p>
        </>
      )}
    </div>
  );
}
