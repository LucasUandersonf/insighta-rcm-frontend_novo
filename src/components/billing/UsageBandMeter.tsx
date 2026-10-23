import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/cn";

export interface BillingBand {
  pricing_model: "flat" | "bands";
  rolling3: number | null;
  included: number;
  next_step_at: number;
  step_price: number;
  unit_price: number;
  steps: number;
  extra_units: number;
  base_price: number | null;
  total_price: number | null;
  pending_new_price: number | null;
  pending_effective_on: string | null;
  history: { month: string; billing: number; rolling3: number }[];
}

function brl(value: number, cents = false): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: cents ? 2 : 0 });
}

function day(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * v1.1 — faixa de faturamento contratada (preço com expansão). Mostra a
 * média de 3 meses do faturamento com convênios contra a faixa, a regra de
 * subida (2 meses seguidos acima do limite + 10%, com 30 dias de aviso) e,
 * no lugar de "faça upgrade", o retorno: quem vê o que recuperou aceita a
 * faixa nova. Só aparece em contrato por faixa.
 */
export function UsageBandMeter() {
  const { data } = useQuery({
    queryKey: ["subscription", "billing-band"],
    queryFn: () => apiClient.get<BillingBand>("/api/v1/subscription/billing-band"),
    staleTime: 10 * 60 * 1000,
  });
  if (!data || data.pricing_model !== "bands") return null;

  const used = data.rolling3 ?? 0;
  const pct = data.included > 0 ? used / data.included : 0;
  const tone = pct > 1.1 ? "bg-denied" : pct >= 0.8 ? "bg-pending" : "bg-accent";

  return (
    <section aria-labelledby="usage-band-title" className="flex flex-col gap-3 rounded-xl border border-border-hairline bg-glass p-6 shadow-elevated backdrop-blur-xl">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="usage-band-title" className="text-lg font-semibold text-ink">
          Faixa de faturamento
        </h2>
        {data.total_price !== null && <span className="tabular text-sm text-ink-muted">{brl(data.total_price, true)}/mês</span>}
      </div>
      <p className="text-sm text-ink-soft">Faturamento com convênios (média dos últimos 3 meses)</p>
      <div
        className="h-2.5 overflow-hidden rounded-full bg-canvas-inset"
        role="meter"
        aria-label="Uso da faixa de faturamento"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(Math.min(pct, 1) * 100)}
      >
        <div className={cn("h-full", tone)} style={{ width: `${Math.min(pct, 1) * 100}%` }} />
      </div>
      <div className="flex flex-wrap justify-between gap-2 text-sm">
        <span className="tabular text-ink">
          {data.rolling3 === null ? "Ainda sem mês fechado medido" : `${brl(used)} de ${brl(data.included)} incluídos`}
        </span>
        {data.rolling3 !== null && <span className="tabular text-ink-muted">{Math.round(pct * 100)}%</span>}
      </div>
      {data.pending_new_price !== null && data.pending_effective_on ? (
        <p className="rounded-md border border-pending/30 bg-pending-bg px-3 py-2 text-sm text-pending">
          A clínica passou da faixa por 2 meses seguidos. A partir de {day(data.pending_effective_on)}, a mensalidade passa a{" "}
          {brl(data.pending_new_price, true)}. O aviso também foi por e-mail aos donos.
        </p>
      ) : (
        <p className="text-xs leading-relaxed text-ink-faint">
          A faixa só muda depois de 2 meses seguidos com a média acima de {brl(data.next_step_at)}, com 30 dias de aviso:
          + {brl(data.step_price, true)}/mês a cada R$ 250 mil a mais. Importar mais dados nunca aumenta a mensalidade sozinho.
        </p>
      )}
      <div className="flex flex-wrap justify-between gap-2 text-sm text-ink-muted">
        <span>
          Unidades: 1 incluída{data.extra_units > 0 ? ` + ${data.extra_units} adicional(is)` : ""}
        </span>
        <span>+ {brl(data.unit_price, true)} por unidade adicional</span>
      </div>
      <Link to="/resultado" className="self-start text-sm font-medium text-accent underline">
        Ver quanto o Insighta recuperou
      </Link>
    </section>
  );
}
