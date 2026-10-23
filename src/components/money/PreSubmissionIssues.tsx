import { AlertTriangle, CheckCircle2, CircleDollarSign, Info } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatDateBR } from "@/lib/dates";
import type { PreSubmissionGroup } from "@/lib/types";

export function brl(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function percent(rate: number | null): string {
  return rate == null ? "—" : `${(rate * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

export function VerdictBadge({ verdict }: { verdict: PreSubmissionGroup["verdict"] }) {
  return verdict === "pronto" ? <Badge tone="revenue">Pronto para enviar</Badge> : <Badge tone="denied">Revisar antes</Badge>;
}

/**
 * Checagens de um convênio + lote (Conferência antes do envio): o que
 * bloqueia o envio primeiro, depois os avisos e o dinheiro a mais, cada um
 * com o R$, o que fazer e as contas.
 */
export function PreSubmissionIssues({ group }: { group: PreSubmissionGroup }) {
  if (group.issues.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm text-ink">
        <CheckCircle2 aria-hidden size={16} className="text-revenue" />
        Nenhum problema encontrado nas {group.items} contas. Pode enviar.
      </p>
    );
  }
  return (
    <div className="space-y-4">
      {group.expected_denial != null && group.expected_denial > 0 && (
        <p className="text-sm text-ink-muted">
          Pelo histórico de {group.plan_name} ({percent(group.denial_rate)} do valor recusado nos últimos 6 meses), enviar como
          está deve render cerca de <strong className="text-ink">{brl(group.expected_denial)}</strong> em glosa.
        </p>
      )}
      <ul className="space-y-3">
        {group.issues.map((issue) => {
          const Icon = issue.kind === "ganho" ? CircleDollarSign : issue.blocking ? AlertTriangle : Info;
          const tone = issue.kind === "ganho" ? "text-revenue" : issue.blocking ? "text-denied" : "text-pending";
          return (
            <li key={issue.code} className="rounded-lg border border-border-hairline bg-canvas-raised/40 px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <Icon aria-hidden size={16} className={tone} />
                  {issue.label}
                </p>
                <p className="text-sm tabular text-ink">
                  {issue.count} {issue.count === 1 ? "conta" : "contas"} ·{" "}
                  <span className={tone}>
                    {issue.kind === "ganho" ? "+" : ""}
                    {brl(issue.value)}
                  </span>
                </p>
              </div>
              <p className="mt-1 text-xs text-ink-muted">
                {issue.blocking ? "Bloqueia o envio. " : ""}
                {issue.what_to_do}
              </p>
              {issue.items.length > 0 && (
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-ink-faint">
                      <tr>
                        <th className="py-1 pr-3 font-medium">Atendimento</th>
                        <th className="py-1 pr-3 font-medium">Paciente</th>
                        <th className="py-1 pr-3 font-medium">Procedimento</th>
                        <th className="py-1 text-right font-medium">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-hairline">
                      {issue.items.map((item) => (
                        <tr key={item.billing_id}>
                          <td className="py-1 pr-3 tabular">
                            {formatDateBR(item.service_date, {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                            })}
                          </td>
                          <td className="py-1 pr-3">{item.patient ?? "—"}</td>
                          <td className="py-1 pr-3">{item.procedure ?? "—"}</td>
                          <td className="py-1 text-right tabular">{brl(item.value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {issue.items.length < issue.count && (
                    <p className="mt-1 text-2xs text-ink-faint">
                      Mostrando {issue.items.length} de {issue.count}.
                    </p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
