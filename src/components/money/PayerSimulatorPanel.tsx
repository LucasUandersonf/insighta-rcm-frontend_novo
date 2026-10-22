import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Panel, EmptyState, LoadingState, ErrorState } from "@/components/ui/Panel";
import { brl, percent } from "@/components/money/PreSubmissionIssues";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import type { PayerSimulation, SimulatorPlan, SimulatorVerdict } from "@/lib/types";

const VERDICT: Record<SimulatorVerdict, { text: string; tone: string }> = {
  prejuizo: { text: "Este convênio dá prejuízo: o que ele paga não cobre repasse e material.", tone: "text-denied" },
  abaixo_da_clinica: { text: "Paga menos por hora de agenda do que a média da clínica.", tone: "text-pending" },
  abaixo_da_clinica_e_rede: {
    text: "Paga menos por hora do que a média da clínica e menos do que paga às outras clínicas.",
    tone: "text-pending",
  },
  abaixo_da_rede: { text: "Paga a você menos do que paga às outras clínicas pelos mesmos procedimentos.", tone: "text-pending" },
  saudavel: { text: "Contrato saudável: margem por hora em linha com a clínica.", tone: "text-revenue" },
};

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

function Answer({ question, value, detail }: { question: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border border-border-subtle p-4">
      <p className="text-xs text-ink-muted">{question}</p>
      <p className="mt-1 text-xl font-semibold tabular text-ink">{value}</p>
      <p className="mt-1 text-xs text-ink-faint">{detail}</p>
    </div>
  );
}

/**
 * Simulador de convênio: escolhe o convênio, digita o reajuste e lê três
 * respostas — quanto entra a mais, quanto se perde saindo e quanto ele paga
 * a menos do que paga às outras clínicas (mediana anônima da rede).
 */
export function PayerSimulatorPanel() {
  const plans = useQuery({
    queryKey: ["financeiro", "simulador"],
    queryFn: () => apiClient.get<SimulatorPlan[]>("/api/v1/financeiro/simulador"),
    retry: false,
  });
  const [planId, setPlanId] = useState<string>("");
  const [readjust, setReadjust] = useState(5);
  const debounced = useDebounced(readjust, 300);
  const selected = planId || plans.data?.[0]?.plan_id || "";

  const sim = useQuery({
    queryKey: ["financeiro", "simulador", selected, debounced],
    queryFn: () => apiClient.get<PayerSimulation>(`/api/v1/financeiro/simulador/${selected}?reajuste=${debounced}`),
    enabled: !!selected,
    retry: false,
  });
  const s = sim.data;
  const verdict = s ? VERDICT[s.verdict] : null;
  const compared = s?.procedures.filter((p) => p.network_paid_median !== null || p.network_contract_median !== null) ?? [];

  return (
    <Panel
      title="Simulador de convênio"
      subtitle="Últimos 12 meses do convênio na clínica: o que entrou, glosa, repasse e material. A rede é a mediana anônima de outras clínicas, só com 3 ou mais."
    >
      {plans.isLoading && <LoadingState />}
      {plans.error && <ErrorState message={getApiErrorMessage(plans.error)} />}
      {plans.data && plans.data.length === 0 && <EmptyState message="Nenhum convênio com contas nos últimos 12 meses." />}
      {plans.data && plans.data.length > 0 && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex flex-col text-xs text-ink-muted">
              Convênio
              <select
                value={selected}
                onChange={(e) => setPlanId(e.target.value)}
                className="mt-1 rounded-md border border-border-subtle bg-canvas px-2 py-1.5 text-sm text-ink"
              >
                {plans.data.map((p) => (
                  <option key={p.plan_id} value={p.plan_id}>
                    {p.plan_name} · {brl(p.billed_12m)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-xs text-ink-muted">
              E se reajustar (%)
              <input
                type="number"
                min={-50}
                max={100}
                step={0.5}
                value={readjust}
                onChange={(e) => setReadjust(Math.max(-50, Math.min(100, Number(e.target.value) || 0)))}
                className="mt-1 w-24 rounded-md border border-border-subtle bg-canvas px-2 py-1.5 text-sm text-ink"
              />
            </label>
          </div>

          {sim.isLoading && <LoadingState />}
          {sim.error && <ErrorState message={getApiErrorMessage(sim.error)} />}
          {s && verdict && (
            <>
              <p className={`text-sm font-medium ${verdict.tone}`}>{verdict.text}</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <Answer
                  question={`E se reajustar ${s.readjust_pct.toLocaleString("pt-BR")}%?`}
                  value={`${s.readjust_gain >= 0 ? "+" : ""}${brl(s.readjust_gain)} por ano`}
                  detail={`Sobre ${brl(s.received)} recebidos em ${s.accounts} contas, mesma glosa e volume.`}
                />
                <Answer
                  question="E se sair dele?"
                  value={`${brl(-s.leave_contribution_lost)} de margem`}
                  detail={
                    s.leave_breakeven_share === null
                      ? "Sem horas de agenda suficientes para comparar com a clínica."
                      : s.leave_breakeven_share <= 0
                        ? "Sair libera agenda sem perder margem."
                        : `Empata se outros pacientes ocuparem ${percent(Math.min(s.leave_breakeven_share, 9.99))} das horas liberadas.`
                  }
                />
                <Answer
                  question="Ele paga às outras clínicas mais do que a você?"
                  value={s.network_gap === null ? "Sem base na rede" : s.network_gap > 0 ? `${brl(s.network_gap)} por ano` : "Não"}
                  detail={
                    s.network_gap === null
                      ? "Aparece quando 3 ou mais clínicas atendem o mesmo convênio e procedimento."
                      : "Diferença para a mediana da rede nos procedimentos em que você recebe menos."
                  }
                />
              </div>
              <p className="text-xs text-ink-faint">
                Margem por hora: {s.contribution_per_hour === null ? "—" : brl(s.contribution_per_hour)} neste convênio
                {s.clinic_contribution_per_hour !== null && `, ${brl(s.clinic_contribution_per_hour)} na clínica`} · glosa{" "}
                {percent(s.denial_rate)} · paga em {s.lag_days === null ? "—" : `${Math.round(s.lag_days)} dias`}
                {s.withholding_pct !== null && ` · retém ${s.withholding_pct.toLocaleString("pt-BR")}%`}
              </p>
              {compared.length > 0 && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-2xs text-ink-faint">
                      <th className="py-1 font-normal">Procedimento</th>
                      <th className="py-1 text-right font-normal">Você recebe</th>
                      <th className="py-1 text-right font-normal">A rede recebe</th>
                      <th className="py-1 text-right font-normal">Contratado na rede</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-hairline">
                    {compared.slice(0, 8).map((p) => (
                      <tr key={p.tuss_code}>
                        <td className="py-1.5 text-ink">
                          {p.procedure_name ?? p.tuss_code}
                          <span className="ml-1 text-2xs text-ink-faint">{p.volume}×</span>
                        </td>
                        <td className="py-1.5 text-right tabular">{p.your_median_paid === null ? "—" : brl(p.your_median_paid)}</td>
                        <td className={`py-1.5 text-right tabular ${(p.paid_gap_per_unit ?? 0) > 0 ? "text-pending" : ""}`}>
                          {p.network_paid_median === null ? "—" : brl(p.network_paid_median)}
                        </td>
                        <td className="py-1.5 text-right tabular">
                          {p.network_contract_median === null ? "—" : brl(p.network_contract_median)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      )}
    </Panel>
  );
}
