import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/Badge";
import { Panel } from "@/components/ui/Panel";
import { platformApiClient } from "@/lib/platform-api-client";

/** v1.1: quem está esfriando — dias sem importar, uso do gestor na semana,
 * demandas paradas e o múltiplo do que a clínica já pagou (retrato diário). */
export function PlatformRetentionPanel() {
  const { data } = useQuery({ queryKey: ["platform", "retention"], queryFn: platformApiClient.getRetention });
  const rows = data ?? [];
  if (rows.length === 0) return null;
  return (
    <Panel title="Retenção" subtitle="As clínicas com mais sinais de que estão esfriando primeiro. Atualiza toda manhã.">
      <div className="overflow-x-auto" tabIndex={0}>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border-hairline text-xs text-ink-muted">
              <th className="px-4 py-2 font-medium">Clínica</th>
              <th className="px-4 py-2 font-medium">Sem importar</th>
              <th className="px-4 py-2 font-medium">Gestor na semana</th>
              <th className="px-4 py-2 font-medium">Paradas</th>
              <th className="px-4 py-2 font-medium">Retorno</th>
              <th className="px-4 py-2 font-medium">Sinais</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.tenant_id} className="border-b border-border-hairline align-top last:border-0">
                <td className="px-4 py-2 text-ink">{r.trade_name}</td>
                <td className="px-4 py-2 tabular-nums">{r.oldest_load_days == null ? "—" : `${r.oldest_load_days} d`}</td>
                <td className="px-4 py-2 tabular-nums">{r.manager_active_days_7d == null ? "—" : `${r.manager_active_days_7d} de 7`}</td>
                <td className="px-4 py-2 tabular-nums">{r.stalled_demands ?? "—"}</td>
                <td className="px-4 py-2 tabular-nums">{r.roi_multiple == null ? "—" : `${r.roi_multiple.toLocaleString("pt-BR")}×`}</td>
                <td className="px-4 py-2">
                  {r.risks.length === 0 ? (
                    <Badge tone="revenue">Saudável</Badge>
                  ) : (
                    <ul className="space-y-0.5 text-xs text-pending">
                      {r.risks.map((risk) => (
                        <li key={risk}>{risk}</li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
