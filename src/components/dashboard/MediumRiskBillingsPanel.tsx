import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { Panel, EmptyState, LoadingState, ErrorState } from "@/components/ui/Panel";
import { Pagination } from "@/components/ui/Pagination";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import type { BillingResponse, PaginatedResponse } from "@/lib/types";

const PAGE_SIZE = 20;

const ITEM_TYPE_LABELS: Record<string, string> = {
  procedimento: "Procedimento",
  material_opme: "OPME",
  taxa: "Taxa",
  diaria: "Diária",
  medicamento: "Medicamento",
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(
    new Date(iso)
  );
}

/**
 * "Contas que valem revisão" (Painel → Faturamento) — Roadmap "Rumo à
 * Nota 9" (Fase 2), achado direto da Auditoria UX: hoje só o risco ALTO
 * de glosa vira fila acionável ("Fila de correção agora", logo acima);
 * risco MÉDIO só aparece contado no donut de distribuição
 * (DenialRiskDistributionPanel), nunca como lista navegável. Campo
 * separado de propósito — nunca misturado com a fila bloqueante de alto
 * risco: risco médio é preventivo (vale uma segunda olhada), não
 * bloqueia envio como o alto risco bloqueia.
 */
export function MediumRiskBillingsPanel() {
  const [offset, setOffset] = useState(0);

  const { data, isLoading, error } = useQuery({
    queryKey: ["billing", "medium-risk", offset],
    queryFn: () =>
      apiClient.get<PaginatedResponse<BillingResponse>>(`/api/v1/billing/medium-risk?limit=${PAGE_SIZE}&offset=${offset}`),
  });

  const billings = data?.items ?? [];

  return (
    <section>
      <h2 className="mb-3 text-sm font-medium text-ink">Contas que valem revisão — risco médio de glosa</h2>
      <Panel subtitle="Sem tabela de preço confirmada pro convênio, ou outro sinal preventivo — dados reais de GET /billing/medium-risk">
        {isLoading && <LoadingState variant="table" rows={4} />}
        {error && <ErrorState message={getApiErrorMessage(error)} />}
        {!isLoading && !error && billings.length === 0 && (
          <EmptyState
            icon={<AlertTriangle size={17} strokeWidth={1.5} />}
            message="Nenhuma conta de risco médio no momento — nada precisando de uma segunda olhada."
          />
        )}
        {!isLoading && billings.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border-hairline text-2xs uppercase tracking-wide text-ink-faint">
                <th className="px-4 py-2.5 font-medium">Criado em</th>
                <th className="px-4 py-2.5 font-medium">Valor cobrado</th>
                <th className="px-4 py-2.5 font-medium">Item</th>
                <th className="px-4 py-2.5 font-medium">Risco</th>
                <th className="px-4 py-2.5 font-medium">Motivos</th>
              </tr>
            </thead>
            <tbody>
              {billings.map((billing) => (
                <tr key={billing.id} className="border-b border-border-hairline last:border-0 transition-colors hover:bg-canvas-raised/60">
                  <td className="px-4 py-2.5 text-ink-muted">{formatDate(billing.created_at)}</td>
                  <td className="tabular px-4 py-2.5 font-mono text-ink">{formatCurrency(billing.charged_value)}</td>
                  <td className="px-4 py-2.5 text-ink-muted">
                    {billing.item_type ? ITEM_TYPE_LABELS[billing.item_type] ?? billing.item_type : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <RiskBadge level={billing.denial_risk_level} />
                  </td>
                  <td className="px-4 py-2.5 text-ink-muted">{billing.denial_reasons.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {data && data.total > 0 && <Pagination total={data.total} limit={PAGE_SIZE} offset={offset} onOffsetChange={setOffset} />}
      </Panel>
    </section>
  );
}
