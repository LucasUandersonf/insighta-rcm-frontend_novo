import { useQuery } from "@tanstack/react-query";
import { brl } from "@/components/money/PreSubmissionIssues";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/context/AuthContext";
import type { VarianceDiagnosis, VarianceMover } from "@/lib/types";

const CAN_VIEW = ["owner", "admin", "financeiro", "auditor"];

function signed(value: number): string {
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${brl(Math.abs(value))}`;
}

function dayMonth(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function Driver({ label, value, max }: { label: string; value: number; max: number }) {
  const width = max > 0 ? Math.max(2, (Math.abs(value) / max) * 100) : 0;
  return (
    <li className="grid grid-cols-[8.5rem_1fr_6.5rem] items-center gap-3 py-1">
      <span className="text-sm text-ink-muted">{label}</span>
      <span className="block h-2 rounded-full bg-canvas-inset" aria-hidden>
        <span
          className={`block h-2 rounded-full ${value < 0 ? "bg-denied" : "bg-revenue"}`}
          style={{ width: `${width}%` }}
        />
      </span>
      <span className={`text-right text-sm tabular ${value < 0 ? "text-denied" : "text-revenue"}`}>{signed(value)}</span>
    </li>
  );
}

function Movers({ title, items }: { title: string; items: VarianceMover[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="mb-1 text-2xs uppercase tracking-wide text-ink-faint">{title}</p>
      <ul className="space-y-0.5">
        {items.map((m) => (
          <li key={m.name} className="flex justify-between gap-3 text-sm">
            <span className="truncate text-ink">{m.name}</span>
            <span className={`tabular ${m.delta < 0 ? "text-denied" : "text-revenue"}`}>{signed(m.delta)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Por que o faturamento mudou: a diferença contra o mesmo trecho do mês
 * passado, decomposta sem sobra em volume, mix de convênios e preço, com
 * as faltas, a glosa e quem mais moveu o número.
 */
export function VarianceBlock() {
  const { user } = useAuth();
  const canView = !!user && CAN_VIEW.includes(user.role);
  const { data } = useQuery({
    queryKey: ["analytics", "diagnostico"],
    queryFn: () => apiClient.get<VarianceDiagnosis>("/api/v1/analytics/diagnostico"),
    enabled: canView,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
  if (!canView || !data || !data.headline) return null;
  const drivers = [
    { label: "Volume de contas", value: data.volume_effect },
    { label: "Mix de convênios", value: data.mix_effect },
    { label: "Preço", value: data.price_effect },
  ];
  const max = Math.max(...drivers.map((d) => Math.abs(d.value)));
  // A frase já fala das faltas quando elas são o motivo: não repete.
  const extraNoShows = data.headline.includes("faltas") ? 0 : data.no_shows_after - data.no_shows_before;
  const deniedDelta = data.denied_after - data.denied_before;

  return (
    <section aria-labelledby="por-que-mudou">
      <h2 id="por-que-mudou" className="mb-1 text-sm font-medium text-ink">
        Por que o faturamento mudou
      </h2>
      <p className="mb-2 text-xs text-ink-muted">
        {dayMonth(data.date_from)} a {dayMonth(data.date_to)} contra {dayMonth(data.prev_from)} a {dayMonth(data.prev_to)}:{" "}
        {brl(data.billed_after)} contra {brl(data.billed_before)}.
      </p>
      <div className="space-y-4 rounded-lg border border-border-hairline bg-glass px-4 py-3">
        <p className="text-sm font-medium text-ink">{data.headline}</p>
        <ul>
          {drivers.map((d) => (
            <Driver key={d.label} label={d.label} value={d.value} max={max} />
          ))}
        </ul>
        {(extraNoShows !== 0 || Math.abs(deniedDelta) >= 0.01) && (
          <p className="text-xs text-ink-muted">
            {extraNoShows > 0 && `${extraNoShows} faltas a mais (≈ ${brl(data.no_show_cost)} no ticket do mês passado). `}
            {extraNoShows < 0 && `${-extraNoShows} faltas a menos. `}
            {deniedDelta > 0.01 && `Glosa ${brl(deniedDelta)} maior.`}
            {deniedDelta < -0.01 && `Glosa ${brl(-deniedDelta)} menor.`}
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Movers title="Convênios que mais moveram" items={data.plan_movers} />
          <Movers title="Profissionais que mais moveram" items={data.professional_movers} />
        </div>
      </div>
    </section>
  );
}
