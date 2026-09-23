import { useQuery } from "@tanstack/react-query";
import { BentoCard } from "@/components/ui/BentoGrid";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import type { NoShowAccuracy } from "@/lib/types";

const LEVEL_LABELS: Record<string, string> = { baixo: "Risco baixo", medio: "Risco médio", alto: "Risco alto" };
const LEVEL_BAR: Record<string, string> = { baixo: "bg-revenue", medio: "bg-pending", alto: "bg-denied" };

function pct(value: number, digits = 0): string {
  return `${(value * 100).toFixed(digits).replace(".", ",")}%`;
}

function shortDate(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(new Date(iso));
}

/** Uma linha dizendo de onde vêm os cortes de risco em vigor. */
export function calibrationNote(data: NoShowAccuracy): string {
  const cuts = `baixo abaixo de ${pct(data.low_threshold)}, alto a partir de ${pct(data.medium_threshold)}`;
  switch (data.calibration_status) {
    case "auto":
      return `Cortes calibrados com o histórico da sua clínica${data.calibrated_at ? ` em ${shortDate(data.calibrated_at)}` : ""}: ${cuts}.`;
    case "manual":
      return `Cortes ajustados manualmente em Minha Clínica: ${cuts}.`;
    case "aprendendo":
      return `Em aprendizado: faltam ${data.days_until_calibration} dias de histórico para calibrar com os dados da sua clínica. Até lá, cortes padrão (${cuts}).`;
    default:
      return `Cortes padrão (${cuts}). A calibração automática roda toda semana.`;
  }
}

/**
 * Frente 1 (nota 9 real) — "o Insighta acerta?" na previsão de falta. O
 * gestor só confia na lista de "ligar para confirmar" se enxergar o
 * acerto dela: das faltas dos últimos 90 dias, quantas estavam
 * sinalizadas, e quanto o risco alto falta a mais que o baixo.
 */
export function NoShowAccuracyCard() {
  const { data } = useQuery({
    queryKey: ["analytics", "no-show-accuracy"],
    queryFn: () => apiClient.get<NoShowAccuracy>("/api/v1/analytics/no-show-accuracy"),
    staleTime: 10 * 60 * 1000,
  });

  if (!data || !Array.isArray(data.by_level)) return null;

  return (
    <BentoCard colSpan={12}>
      <p className="mb-1 text-2xs font-medium text-ink-muted">Acerto da previsão de falta — últimos {data.window_days} dias</p>
      {data.no_shows === 0 || data.hit_rate === null ? (
        <p className="text-xs text-ink-faint">
          Ainda não há faltas com previsão registrada nesta janela — o acerto aparece assim que as primeiras consultas previstas acontecerem.
        </p>
      ) : (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-8">
          <div className="shrink-0">
            <div className="tabular text-[26px] font-semibold tracking-tightest text-ink">{pct(data.hit_rate)}</div>
            <p className="max-w-xs text-xs text-ink-muted">
              Das {data.no_shows} faltas, {data.flagged_no_shows} estavam sinalizadas como risco médio ou alto.
              {data.lift !== null && data.lift >= 1 && ` Quem é risco alto falta ${data.lift.toFixed(1).replace(".", ",")}× mais que risco baixo.`}
            </p>
          </div>
          <div className="flex-1 space-y-2">
            {data.by_level.map((lvl) => (
              <div key={lvl.risk_level} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-xs text-ink-muted">{LEVEL_LABELS[lvl.risk_level] ?? lvl.risk_level}</span>
                <div className="h-[7px] flex-1 overflow-hidden rounded-full bg-canvas-raised">
                  <div
                    className={cn("h-full rounded-full", LEVEL_BAR[lvl.risk_level] ?? "bg-aura-line")}
                    style={{ width: `${Math.min((lvl.no_show_rate ?? 0) * 100, 100)}%` }}
                  />
                </div>
                <span className="tabular w-40 shrink-0 text-right text-2xs text-ink-faint">
                  {lvl.no_show_rate === null ? "sem consultas" : `faltou ${pct(lvl.no_show_rate)} de ${lvl.appointments}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      <p className="mt-3 text-2xs leading-relaxed text-ink-faint">{calibrationNote(data)}</p>
    </BentoCard>
  );
}
