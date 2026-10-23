import { usePlan } from "@/lib/plan";
import type { UsageItem } from "@/lib/types";

/**
 * Uso do plano: quanto a clínica já usou de cada limite (atendimentos dos
 * últimos 30 dias, usuários, convênios com contrato, setores e cotas de IA
 * do mês). Mesmas faixas do backend: aviso aos 80%, acima do limite aos
 * 100% e importação pausada acima de 120% (a IA para no limite).
 */
export function PlanUsagePanel() {
  const { usage } = usePlan();
  if (!usage) return null;

  const rows: { label: string; hint?: string; item?: UsageItem }[] = [
    { label: "Atendimentos", hint: "últimos 30 dias", item: usage.appointments },
    { label: "Usuários ativos", item: usage.users },
    { label: "Convênios com contrato", item: usage.contract_payers },
    { label: "Setores com coordenador", item: usage.coordinator_sectors },
  ];
  const aiRows: { label: string; item?: UsageItem }[] = [
    { label: "Perguntas à IA", item: usage.ai_ask },
    { label: "Minutas de recurso", item: usage.ai_appeal_draft },
    { label: "Leituras de contrato", item: usage.ai_contract_extraction },
  ];
  const hasAi = aiRows.some((r) => r.item && (r.item.limit ?? 0) > 0);

  return (
    <section
      aria-labelledby="plan-usage-title"
      className="flex flex-col gap-4 rounded-xl border border-border-hairline bg-glass p-6 shadow-elevated backdrop-blur-xl"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="plan-usage-title" className="text-lg font-semibold text-ink">
          Uso do plano {usage.plan_label}
        </h2>
        <span className="text-xs text-ink-muted">{usage.history_months} meses de histórico nas análises</span>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2">
        {rows.map((row) => (row.item ? <UsageRow key={row.label} label={row.label} hint={row.hint} item={row.item} /> : null))}
      </ul>
      {hasAi ? (
        <>
          <h3 className="text-sm font-semibold text-ink">
            IA neste mês
            {usage.ai_renews_on ? (
              <span className="ml-2 font-normal text-ink-muted">renova em {formatDay(usage.ai_renews_on)}</span>
            ) : null}
          </h3>
          <ul className="grid gap-4 sm:grid-cols-3">
            {aiRows.map((row) => (row.item ? <UsageRow key={row.label} label={row.label} item={row.item} ai /> : null))}
          </ul>
        </>
      ) : (
        <p className="text-sm text-ink-muted">A Equipe de IA (perguntas livres, leitura de contrato e minuta de recurso) está no plano Pro.</p>
      )}
    </section>
  );
}

function formatDay(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(new Date(iso));
}

function UsageRow({ label, hint, item, ai = false }: { label: string; hint?: string; item: UsageItem; ai?: boolean }) {
  const unlimited = item.limit === null;
  const pct = unlimited || !item.limit ? 0 : Math.min(100, Math.round((item.used / item.limit) * 100));
  const tone =
    item.state === "blocked" ? "bg-denied" : item.state === "over" ? "bg-denied" : item.state === "warn" ? "bg-pending" : "bg-accent";
  const note =
    item.state === "blocked"
      ? ai
        ? "Cota do mês usada."
        : "Acima de 120% do limite: novas importações pausadas até a troca de plano."
      : item.state === "over"
        ? "Acima do limite do plano. Até 120% as importações continuam."
        : item.state === "warn"
          ? "Perto do limite do plano."
          : null;
  return (
    <li className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-ink">
          {label}
          {hint ? <span className="ml-1 text-xs text-ink-muted">({hint})</span> : null}
        </span>
        <span className="tabular-nums text-ink-muted">
          {item.used.toLocaleString("pt-BR")}
          {unlimited ? " · ilimitado" : ` de ${item.limit?.toLocaleString("pt-BR")}`}
        </span>
      </div>
      {!unlimited && (
        <div
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={item.limit ?? 0}
          aria-valuenow={item.used}
          className="h-1.5 overflow-hidden rounded-full bg-border-hairline"
        >
          <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
        </div>
      )}
      {note && <p className={"text-xs " + (item.state === "warn" ? "text-ink-muted" : "text-denied")}>{note}</p>}
    </li>
  );
}
