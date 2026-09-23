import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Copy, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ErrorState, LoadingState } from "@/components/ui/Panel";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { useToast } from "@/context/ToastContext";
import { cn } from "@/lib/cn";
import type { NegotiationArgument, PayerOverview, PayerOverviewRow, PayerVerdict } from "@/lib/types";

/**
 * Convênios → Visão geral (canvas "Insighta RCM — Redesign 2026",
 * artboard "Convênios"): três veredictos, desempenho por convênio com uma
 * leitura em linguagem natural por linha, simulação de prazo com
 * argumento de renegociação e contratos que pedem atenção. Frases vêm
 * prontas do backend (GET /analytics/payer-overview) — regra, não IA.
 */

const brl = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);

const VERDICT_STYLE: Record<PayerVerdict["kind"], { box: string; label: string }> = {
  best: { box: "border-revenue/20 bg-revenue/[0.06]", label: "text-revenue" },
  denials: { box: "border-denied/25 bg-denied/[0.07]", label: "text-denied" },
  slowest: { box: "border-pending/25 bg-pending/[0.07]", label: "text-pending" },
};

const ROW_TONE: Record<PayerOverviewRow["tone"], string> = {
  good: "border-revenue",
  warn: "border-pending",
  bad: "border-denied",
  neutral: "border-ink-faint",
};

function Simulation({ rows, defaultPlanId, dateFrom, dateTo }: { rows: PayerOverviewRow[]; defaultPlanId: string | null; dateFrom: string; dateTo: string }) {
  const { showSuccess } = useToast();
  const candidates = rows.filter((r) => r.plan_type !== "particular" && r.avg_days_to_receive !== null && r.avg_days_to_receive > 1);
  const [planId, setPlanId] = useState<string | null>(defaultPlanId ?? candidates[0]?.insurance_plan_id ?? null);
  const plan = candidates.find((r) => r.insurance_plan_id === planId) ?? candidates[0];
  const currentDays = plan ? Math.round(plan.avg_days_to_receive!) : 0;
  const [days, setDays] = useState(() => Math.max(1, Math.min(currentDays, 45)));
  useEffect(() => {
    setDays(Math.max(1, Math.min(currentDays, 45)));
  }, [plan?.insurance_plan_id, currentDays]);

  const argument = useMutation({
    mutationFn: () =>
      apiClient.post<NegotiationArgument>("/api/v1/analytics/payer-negotiation-argument", { insurance_plan_id: plan!.insurance_plan_id, target_days: days, date_from: dateFrom, date_to: dateTo }),
  });

  if (!plan) {
    return (
      <section className="rounded-[20px] border border-border-hairline bg-glass p-6 text-sm text-ink-muted">
        A simulação aparece assim que houver pagamentos de convênio conciliados no período.
      </section>
    );
  }

  const windowDays = Math.round((new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / 86_400_000) + 1;
  const monthlyBilled = plan.billed / Math.max(1, windowDays / 30);
  const released = Math.max(0, (monthlyBilled * (currentDays - days)) / 30);

  return (
    <section
      aria-labelledby="sim"
      className="flex flex-col gap-3.5 rounded-[20px] border border-accent/30 bg-[linear-gradient(160deg,hsl(var(--brand)/0.16),hsl(var(--brand)/0.03)_70%)] p-6"
    >
      <span className="flex items-center gap-2 text-xs font-medium text-accent-muted">
        <SlidersHorizontal aria-hidden size={14} />
        Simulação de decisão
      </span>
      <h2 id="sim" className="font-serif text-[21px] font-medium leading-snug text-ink">
        E se{" "}
        {candidates.length > 1 ? (
          <label className="relative inline-flex items-center">
            <span className="underline decoration-dotted underline-offset-4">{plan.name}</span>
            <select
              aria-label="Convênio da simulação"
              value={plan.insurance_plan_id}
              onChange={(e) => {
                setPlanId(e.target.value);
                argument.reset();
              }}
              className="absolute inset-0 cursor-pointer opacity-0"
            >
              {candidates.map((r) => (
                <option key={r.insurance_plan_id} value={r.insurance_plan_id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          plan.name
        )}{" "}
        pagasse em {days} dias?
      </h2>
      <label htmlFor="prazo-sim" className="text-xs text-ink-muted">
        Prazo negociado: <span className="font-semibold text-ink">{days} dias</span> (hoje: {currentDays} dias)
      </label>
      <input
        id="prazo-sim"
        type="range"
        min={1}
        max={currentDays}
        step={1}
        value={days}
        onChange={(e) => {
          setDays(Number(e.target.value));
          argument.reset();
        }}
        className="w-full accent-[hsl(var(--accent))]"
      />
      <div className="flex flex-col gap-1.5 rounded-[14px] border border-border-hairline bg-canvas/55 p-4">
        <span className="text-xs text-ink-muted">Caixa liberado por mês</span>
        <span className="tabular text-[30px] font-semibold tracking-[-0.02em] text-revenue">{brl(released)}</span>
        <span className="text-[13px] leading-normal text-ink-soft">
          {days >= currentDays
            ? `Sem mudança: o prazo atual já é ${currentDays} dias.`
            : `Encurtar ${currentDays - days} dias antecipa esse valor todo mês — dinheiro que hoje fica parado esperando o repasse.`}
        </span>
      </div>
      <Button type="button" onClick={() => argument.mutate()} disabled={argument.isPending || days >= currentDays} className="h-10">
        {argument.isPending ? "Gerando argumento…" : "Gerar argumento de renegociação"}
      </Button>
      {argument.error && <p className="text-sm text-denied">{getApiErrorMessage(argument.error)}</p>}
      {argument.data && (
        <div className="flex flex-col gap-2 rounded-[14px] border border-border-hairline bg-canvas/55 p-4">
          <p className="text-sm leading-relaxed text-ink">{argument.data.argument}</p>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(argument.data!.argument);
              showSuccess("Argumento copiado.");
            }}
            className="flex items-center gap-1.5 self-start text-xs font-medium text-accent-muted hover:underline"
          >
            <Copy aria-hidden size={12} />
            Copiar texto
          </button>
        </div>
      )}
    </section>
  );
}

export function PayerOverviewPanel({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["analytics", "payer-overview", dateFrom, dateTo],
    queryFn: () => apiClient.get<PayerOverview>(`/api/v1/analytics/payer-overview?date_from=${dateFrom}&date_to=${dateTo}`),
  });
  const slowestPlanId = useMemo(() => {
    if (!data) return null;
    const slowest = data.verdicts.find((v) => v.kind === "slowest");
    return data.rows.find((r) => r.name === slowest?.name)?.insurance_plan_id ?? null;
  }, [data]);

  if (isLoading) return <LoadingState variant="cards" rows={3} />;
  if (error) return <ErrorState message={getApiErrorMessage(error)} onRetry={() => refetch()} />;
  if (!data || data.rows.length === 0) {
    return (
      <p className="rounded-[20px] border border-border-hairline bg-glass p-6 text-sm text-ink-muted">
        Ainda não há faturamento de convênio neste período. Assim que houver, esta visão mostra quem paga bem, quem glosa e quem segura seu caixa.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-7">
      {data.verdicts.length > 0 && (
        <section aria-label="Veredictos" className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {data.verdicts.map((verdict) => (
            <article key={verdict.kind} className={cn("flex flex-col gap-2.5 rounded-[18px] border p-[22px]", VERDICT_STYLE[verdict.kind].box)}>
              <span className={cn("text-xs font-semibold", VERDICT_STYLE[verdict.kind].label)}>{verdict.label}</span>
              <h2 className="font-serif text-[22px] font-medium text-ink">{verdict.name}</h2>
              <p className="text-sm leading-relaxed text-ink-soft">{verdict.text}</p>
            </article>
          ))}
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section aria-labelledby="desempenho" className="flex flex-col gap-3.5 rounded-[20px] border border-border-hairline bg-glass p-6">
          <h2 id="desempenho" className="text-base font-semibold text-ink">
            Desempenho por convênio
          </h2>
          <div className="hidden grid-cols-[170px_70px_70px_minmax(0,1fr)_110px] gap-4 px-3.5 text-xs text-ink-faint md:grid">
            <span>Convênio</span>
            <span>Glosa</span>
            <span>Prazo</span>
            <span>Participação</span>
            <span className="text-right">Faturado</span>
          </div>
          {data.rows.map((row) => (
            <div key={row.insurance_plan_id} className="flex flex-col gap-2.5 rounded-[14px] bg-canvas-raised/30 p-3.5 transition-colors hover:bg-canvas-raised/55">
              <div className="grid grid-cols-2 items-center gap-x-4 gap-y-1.5 md:grid-cols-[170px_70px_70px_minmax(0,1fr)_110px]">
                <span className="truncate text-sm font-medium text-ink">{row.name}</span>
                <span className={cn("text-[13px] font-semibold", row.denial_pct >= 10 ? "text-denied" : row.denial_pct >= 6 ? "text-pending" : "text-ink")}>
                  <span className="md:hidden text-ink-faint font-normal">Glosa </span>
                  {row.denial_pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
                </span>
                <span className={cn("text-[13px] font-semibold", (row.avg_days_to_receive ?? 0) >= 50 ? "text-pending" : "text-ink")}>
                  <span className="md:hidden text-ink-faint font-normal">Prazo </span>
                  {row.plan_type === "particular" ? "à vista" : row.avg_days_to_receive !== null ? `${Math.round(row.avg_days_to_receive)}d` : "—"}
                </span>
                <span className="col-span-2 flex items-center gap-2.5 md:col-span-1">
                  <span className="w-[38px] text-xs text-ink-faint">{Math.round(row.share_pct)}%</span>
                  <span aria-hidden className="flex h-4 flex-1 overflow-hidden rounded bg-[repeating-linear-gradient(90deg,hsl(var(--ink)/0.07)_0_3px,transparent_3px_6px)]">
                    <span
                      className="rounded bg-revenue/85"
                      style={{ width: `${Math.round((row.share_pct / Math.max(1, data.rows[0].share_pct)) * 100)}%` }}
                    />
                  </span>
                </span>
                <span className="tabular text-right text-[15px] font-semibold text-ink">{brl(row.billed)}</span>
              </div>
              <span className={cn("border-l-2 pl-3 text-[13px] leading-snug text-ink-soft", ROW_TONE[row.tone])}>{row.read}</span>
            </div>
          ))}
        </section>

        <div className="flex flex-col gap-6">
          <Simulation rows={data.rows} defaultPlanId={slowestPlanId} dateFrom={dateFrom} dateTo={dateTo} />
          <section aria-labelledby="contratos-atencao" className="flex flex-col gap-3 rounded-[20px] border border-border-hairline bg-glass p-6">
            <h2 id="contratos-atencao" className="text-base font-semibold text-ink">
              Contratos que pedem atenção
            </h2>
            {data.attention.length === 0 ? (
              <p className="text-[13px] text-ink-muted">Nenhum contrato vencendo nem pagando abaixo da tabela agora.</p>
            ) : (
              data.attention.map((item) => (
                <div key={item.title} className={cn("flex items-start gap-3 rounded-xl p-3", item.tone === "critical" ? "bg-denied/[0.07]" : "bg-pending/[0.07]")}>
                  <span aria-hidden className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", item.tone === "critical" ? "bg-denied" : "bg-pending")} />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[13px] font-medium text-ink">{item.title}</span>
                    <span className="text-xs leading-snug text-ink-muted">{item.text}</span>
                    {item.href && (
                      <Link to={item.href} className="text-xs font-medium text-accent-muted hover:underline">
                        Ver detalhes →
                      </Link>
                    )}
                  </div>
                </div>
              ))
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
