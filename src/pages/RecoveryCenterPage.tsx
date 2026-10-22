import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Panel, EmptyState, LoadingState, ErrorState } from "@/components/ui/Panel";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { TabPanel, Tabs } from "@/components/ui/Tabs";
import { brl, percent } from "@/components/money/PreSubmissionIssues";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { formatDateBR } from "@/lib/dates";
import { useToast } from "@/context/ToastContext";
import { useAuth } from "@/context/AuthContext";
import type { RecoveryCenter, RecoveryFront, RecoveryItem } from "@/lib/types";

const RECOVERY_KEY = ["financeiro", "recuperacao"] as const;
const CAN_APPEAL = ["owner", "admin", "financeiro"];

function date(iso: string | null): string {
  return formatDateBR(iso, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function Deadline({ item }: { item: RecoveryItem }) {
  if (item.days_left == null || !item.deadline) return <>—</>;
  const tone = item.days_left <= 3 ? "text-denied" : item.days_left <= 7 ? "text-pending" : "text-ink";
  const label = item.days_left === 0 ? "vence hoje" : `${item.days_left} ${item.days_left === 1 ? "dia" : "dias"}`;
  return (
    <span className={tone}>
      {date(item.deadline)} ({label})
    </span>
  );
}

function ItemAction({ front, item }: { front: RecoveryFront; item: RecoveryItem }) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const { user } = useAuth();
  const open = useMutation({
    mutationFn: () =>
      apiClient.post("/api/v1/denial-appeals", {
        billing_id: item.billing_id,
        appeal_type: "administrativa",
        denied_at: item.denied_at,
        operator_denial_reason: item.reason,
      }),
    onSuccess: () => {
      showSuccess("Recurso aberto. Ele já aparece em Recursos de glosa, com o prazo.");
      void queryClient.invalidateQueries({ queryKey: RECOVERY_KEY });
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });
  // Cobrar o convênio ou o paciente: o que entrar depois disso vai para o
  // "Recuperado pela Central" do Extrato de Resultado.
  const charge = useMutation({
    mutationFn: () =>
      apiClient.post("/api/v1/financeiro/recuperacao/cobrado", {
        billing_id: item.billing_id,
        front: front.action === "cobrar_convenio" ? "sem_retorno" : "coparticipacao",
      }),
    onSuccess: () => {
      showSuccess("Marcado como cobrado. Quando o pagamento entrar, ele aparece no Extrato de Resultado.");
      void queryClient.invalidateQueries({ queryKey: RECOVERY_KEY });
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  if (front.action === "cobrar_convenio" || front.action === "cobrar_paciente") {
    if (item.charged_at) {
      return <span className="text-xs text-ink-muted">Cobrado em {formatDateBR(item.charged_at, { day: "2-digit", month: "2-digit" })}</span>;
    }
    if (!user || !CAN_APPEAL.includes(user.role)) return null;
    return (
      <Button size="xs" variant="secondary" disabled={charge.isPending} onClick={() => charge.mutate()}>
        {charge.isPending ? "Salvando…" : "Marcar como cobrado"}
      </Button>
    );
  }
  if (front.action === "abrir_recurso") {
    if (!user || !CAN_APPEAL.includes(user.role) || !item.denied_at) return null;
    return (
      <Button size="xs" variant="secondary" disabled={open.isPending} onClick={() => open.mutate()}>
        {open.isPending ? "Abrindo…" : "Abrir recurso"}
      </Button>
    );
  }
  if (front.action === "ver_recurso") {
    return (
      <Link to="/recursos-de-glosa" className="text-xs text-accent underline">
        Ver recurso
      </Link>
    );
  }
  return null;
}

/**
 * Central de Recuperação: todo dinheiro que a clínica ainda pode trazer de
 * volta, por frente, do mais urgente para o menos, e o que já voltou nos
 * últimos 90 dias.
 */
const VISIBLE_ITEMS = 10;

export function RecoveryCenterPage() {
  const [active, setActive] = useState("glosa_sem_recurso");
  // Homologação v1.0.0: 190 contas de uma vez pesavam a tela; o gestor lê o
  // total e as mais urgentes, o resto fica a um clique.
  const [showAll, setShowAll] = useState(false);
  const { data, isLoading, error } = useQuery({
    queryKey: RECOVERY_KEY,
    queryFn: () => apiClient.get<RecoveryCenter>("/api/v1/financeiro/recuperacao"),
  });
  const front = data?.fronts.find((f) => f.code === active) ?? data?.fronts[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Central de Recuperação"
        subtitle="Glosas sem recurso, pagamentos abaixo do contrato, contas sem retorno e coparticipação: tudo o que ainda dá para trazer de volta."
      />
      {isLoading && <LoadingState />}
      {error && <ErrorState message={getApiErrorMessage(error)} />}
      {data && (
        <>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-border-hairline bg-glass px-4 py-3">
              <dt className="text-xs text-ink-faint">Dá para recuperar</dt>
              <dd className="text-lg font-semibold tabular text-revenue">{brl(data.recoverable)}</dd>
            </div>
            <div className="rounded-lg border border-border-hairline bg-glass px-4 py-3">
              <dt className="text-xs text-ink-faint">Prazo acaba em 7 dias</dt>
              <dd className="text-lg font-semibold tabular text-denied">{brl(data.due_7_days)}</dd>
            </div>
            <div className="rounded-lg border border-border-hairline bg-glass px-4 py-3">
              <dt className="text-xs text-ink-faint">Em recurso</dt>
              <dd className="text-lg font-semibold tabular text-ink">{brl(data.in_appeal)}</dd>
            </div>
            <div className="rounded-lg border border-border-hairline bg-glass px-4 py-3">
              <dt className="text-xs text-ink-faint">Recuperado em {data.results.days} dias</dt>
              <dd className="text-lg font-semibold tabular text-revenue">{brl(data.results.recovered)}</dd>
              <dd className="text-2xs text-ink-faint">
                {data.results.recovered_count} recursos ganhos · taxa de sucesso {percent(data.results.success_rate)}
              </dd>
            </div>
          </dl>
          {data.results.lost_deadline > 0 && (
            <p className="rounded-lg border border-denied/30 bg-denied-bg/40 px-4 py-2 text-sm text-ink">
              Nos últimos {data.results.days} dias, {brl(data.results.lost_deadline)} em glosas (
              {data.results.lost_deadline_count}) perderam o prazo de recurso sem ninguém contestar.
            </p>
          )}

          <Panel>
            <div className="px-6 pt-4">
              <Tabs
                groupId="recuperacao"
                active={front?.code ?? active}
                onChange={(id) => {
                  setActive(id);
                  setShowAll(false);
                }}
                items={data.fronts.map((f) => ({
                  id: f.code,
                  label: `${f.label} · ${brl(f.value)}`,
                }))}
              />
            </div>
            {front && (
              <TabPanel id={front.code} groupId="recuperacao">
                <div className="space-y-3 px-6 py-5">
                  <p className="text-sm text-ink-muted">
                    {front.count} {front.count === 1 ? "conta" : "contas"}. {front.what_to_do}
                  </p>
                  {front.items.length === 0 ? (
                    <EmptyState message="Nada nesta frente agora." />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="text-xs text-ink-faint">
                          <tr>
                            <th className="py-1 pr-3 font-medium">Convênio</th>
                            <th className="py-1 pr-3 font-medium">Paciente</th>
                            <th className="py-1 pr-3 font-medium">Atendimento</th>
                            <th className="py-1 pr-3 font-medium">Motivo</th>
                            <th className="py-1 pr-3 font-medium">Prazo</th>
                            <th className="py-1 pr-3 text-right font-medium">Valor</th>
                            <th className="py-1 font-medium">
                              <span className="sr-only">Ação</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-hairline">
                          {(showAll ? front.items : front.items.slice(0, VISIBLE_ITEMS)).map((item) => (
                            <tr key={`${item.billing_id}-${item.appeal_id ?? ""}`}>
                              <td className="py-1.5 pr-3">{item.plan_name}</td>
                              <td className="py-1.5 pr-3">{item.patient ?? "—"}</td>
                              <td className="py-1.5 pr-3 tabular">{date(item.service_date)}</td>
                              <td className="py-1.5 pr-3 text-xs text-ink-muted">{item.reason ?? "—"}</td>
                              <td className="py-1.5 pr-3 text-xs tabular">
                                <Deadline item={item} />
                              </td>
                              <td className="py-1.5 pr-3 text-right tabular font-medium">{brl(item.value)}</td>
                              <td className="py-1.5">
                                <ItemAction front={front} item={item} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {!showAll && front.items.length > VISIBLE_ITEMS ? (
                        <button type="button" className="mt-2 text-xs font-medium text-accent hover:underline" onClick={() => setShowAll(true)}>
                          Ver todas as {front.count} contas
                        </button>
                      ) : (
                        front.items.length < front.count && (
                          <p className="mt-1 text-2xs text-ink-faint">
                            Mostrando {front.items.length} de {front.count}, as mais urgentes primeiro.
                          </p>
                        )
                      )}
                    </div>
                  )}
                </div>
              </TabPanel>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
