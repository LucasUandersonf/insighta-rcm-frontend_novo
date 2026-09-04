import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ListChecks, TriangleAlert } from "lucide-react";
import { Panel, EmptyState, LoadingState, ErrorState } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { SelectField } from "@/components/ui/FormField";
import { PageHeader } from "@/components/ui/PageHeader";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { useToast } from "@/context/ToastContext";
import type { InsurancePlan, RejectedRow, ResolveInsurancePlanResponse } from "@/lib/types";

// Tela de Setup — o destino que o próprio toast de sucesso da Central de
// Upload já promete ("veja a tela de Setup para resolver") mas que não
// existia no frontend: o backend suporta 100% este fluxo há tempo
// (GET /ingestion/rejected, POST .../resolve-insurance-plan — ver
// app/api/v1/endpoints/ingestion.py), só faltava a tela. Sem ela, uma
// linha rejeitada por convênio não reconhecido ficava permanentemente
// fora do faturamento — o usuário não tinha como saber que existia,
// muito menos como corrigir.
//
// Duas categorias de rejeição, tratamento bem diferente para cada uma
// (ver DECISÃO em RejectedRow, lib/types.ts):
//   - "unknown_insurance_plan": ACIONÁVEL aqui — o humano mapeia o texto
//     cru do convênio para um plano já cadastrado, e isso promove a
//     linha (e qualquer outra pendente com o MESMO texto cru, resolvida
//     em lote pelo próprio backend).
//   - qualquer outro motivo (hoje só "validation_error"): falha
//     ESTRUTURAL do arquivo de origem (data/moeda/campo obrigatório
//     malformado) — não tem mapeamento possível nesta tela, só
//     corrigir o arquivo e reenviar pela Central de Upload.

const REJECTED_PAGE_LIMIT = 200;

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
}

function formatMoney(value: unknown): string | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

interface UnknownPlanGroup {
  rawValue: string;
  rows: RejectedRow[];
}

function ResolveInsurancePlanModal({
  isOpen,
  onClose,
  group,
}: {
  isOpen: boolean;
  onClose: () => void;
  group: UnknownPlanGroup | null;
}) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [planId, setPlanId] = useState("");

  const { data: plans, isLoading: plansLoading } = useQuery({
    queryKey: ["insurance-plans"],
    queryFn: () => apiClient.get<InsurancePlan[]>("/api/v1/insurance-companies/plans"),
    enabled: isOpen,
  });

  const resolveMutation = useMutation({
    mutationFn: (insurancePlanId: string) => {
      const targetRowId = group!.rows[0].id;
      return apiClient.post<ResolveInsurancePlanResponse>(
        `/api/v1/ingestion/rejected/${targetRowId}/resolve-insurance-plan`,
        { insurance_plan_id: insurancePlanId }
      );
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["rejected-rows"] });
      // additionally_resolved_count é SÓ as demais linhas com o mesmo
      // raw_value (ver DECISÃO em NormalizationService.resolve_unknown_insurance_plan)
      // — a linha-alvo em si conta à parte (`resolved`).
      const total = (result.resolved ? 1 : 0) + result.additionally_resolved_count;
      showSuccess(
        total > 1
          ? `${total} lançamentos de "${group!.rawValue}" foram mapeados e entraram no faturamento.`
          : `Lançamento de "${group!.rawValue}" foi mapeado e entrou no faturamento.`
      );
      setPlanId("");
      onClose();
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  if (!group) return null;

  return (
    <Modal title="Mapear convênio não reconhecido" isOpen={isOpen} onClose={onClose}>
      <p className="mb-4 text-sm text-ink-muted">
        O arquivo trouxe o convênio escrito como{" "}
        <span className="rounded bg-canvas-raised px-1.5 py-0.5 font-mono text-xs text-ink">{group.rawValue}</span> — a
        importação automática não reconheceu esse texto. Escolha a qual plano ele corresponde: esta e{" "}
        <strong>toda outra linha pendente com o mesmo texto</strong> serão promovidas de uma vez, e da próxima vez que
        esse texto aparecer num arquivo ele já será reconhecido sozinho.
      </p>

      <div className="mb-4 rounded-md border border-border-default bg-canvas-raised/40 px-3 py-2.5">
        <p className="mb-1 text-2xs font-medium uppercase tracking-wide text-ink-faint">
          {group.rows.length} lançamento(s) pendente(s) com este texto
        </p>
        <ul className="space-y-0.5 text-xs text-ink-muted">
          {group.rows.slice(0, 5).map((row) => (
            <li key={row.id}>
              {String(row.payload.patient_name ?? "Paciente não identificado")}
              {formatMoney(row.payload.charged_value) ? ` — ${formatMoney(row.payload.charged_value)}` : ""}
            </li>
          ))}
          {group.rows.length > 5 && <li>+ {group.rows.length - 5} outro(s)</li>}
        </ul>
      </div>

      <SelectField label="Convênio correto" required value={planId} onChange={(e) => setPlanId(e.target.value)}>
        <option value="">{plansLoading ? "Carregando..." : "Selecione..."}</option>
        {(plans ?? []).map((p) => (
          <option key={p.id} value={p.id}>
            {p.display_name}
          </option>
        ))}
      </SelectField>

      <div className="mt-5 flex justify-end gap-2 border-t border-border-hairline pt-4">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          type="button"
          disabled={!planId || resolveMutation.isPending}
          onClick={() => resolveMutation.mutate(planId)}
        >
          {resolveMutation.isPending ? "Mapeando..." : "Mapear e promover"}
        </Button>
      </div>
    </Modal>
  );
}

export function SetupPage() {
  const [resolvingGroup, setResolvingGroup] = useState<UnknownPlanGroup | null>(null);

  const { data: rejected, isLoading, error, refetch } = useQuery({
    queryKey: ["rejected-rows"],
    queryFn: () => apiClient.get<RejectedRow[]>(`/api/v1/ingestion/rejected?limit=${REJECTED_PAGE_LIMIT}`),
  });

  const unknownPlanGroups = useMemo<UnknownPlanGroup[]>(() => {
    const rows = (rejected ?? []).filter((r) => r.reason === "unknown_insurance_plan");
    const byRawValue = new Map<string, RejectedRow[]>();
    for (const row of rows) {
      const key = row.raw_value ?? "";
      if (!byRawValue.has(key)) byRawValue.set(key, []);
      byRawValue.get(key)!.push(row);
    }
    return Array.from(byRawValue.entries()).map(([rawValue, groupRows]) => ({ rawValue, rows: groupRows }));
  }, [rejected]);

  const structuralErrorRows = useMemo(
    () => (rejected ?? []).filter((r) => r.reason !== "unknown_insurance_plan"),
    [rejected]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ListChecks}
        title="Setup de importação"
        subtitle="Linhas que a Central de Upload não conseguiu promover sozinha — resolva o que dá para mapear, corrija o que precisa de um novo envio."
      />

      {isLoading && <LoadingState variant="table" rows={4} />}
      {error && <ErrorState message={getApiErrorMessage(error)} onRetry={() => refetch()} />}

      {!isLoading && !error && (
        <>
          <Panel
            title="Convênios não reconhecidos"
            subtitle="Texto do arquivo não bateu com nenhum convênio cadastrado — mapeie uma vez e todas as linhas com o mesmo texto são promovidas juntas."
          >
            {unknownPlanGroups.length === 0 && (
              <EmptyState
                icon={<ListChecks size={17} strokeWidth={1.5} />}
                message="Nenhum convênio pendente de mapeamento no momento."
              />
            )}
            {unknownPlanGroups.length > 0 && (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border-hairline text-2xs uppercase tracking-wide text-ink-faint">
                    <th className="px-4 py-2.5 font-medium">Texto do convênio no arquivo</th>
                    <th className="px-4 py-2.5 font-medium">Lançamentos pendentes</th>
                    <th className="px-4 py-2.5 font-medium">Recebido em</th>
                    <th className="px-4 py-2.5 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {unknownPlanGroups.map((group) => (
                    <tr
                      key={group.rawValue}
                      className="border-b border-border-hairline last:border-0 transition-colors hover:bg-canvas-raised/60"
                    >
                      <td className="px-4 py-2.5 font-mono text-xs text-ink">{group.rawValue || "—"}</td>
                      <td className="tabular px-4 py-2.5">
                        <Badge tone="pending">{group.rows.length}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-ink-muted">{formatDateTime(group.rows[0].created_at)}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex justify-end">
                          <Button variant="secondary" size="xs" onClick={() => setResolvingGroup(group)}>
                            Mapear convênio
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>

          <Panel
            title="Erros estruturais do arquivo"
            subtitle="Linha com dado inválido (data, valor, campo obrigatório) — sem mapeamento possível aqui; corrija na origem e reenvie o arquivo."
          >
            {structuralErrorRows.length === 0 && (
              <EmptyState
                icon={<TriangleAlert size={17} strokeWidth={1.5} />}
                message="Nenhum erro estrutural pendente no momento."
              />
            )}
            {structuralErrorRows.length > 0 && (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border-hairline text-2xs uppercase tracking-wide text-ink-faint">
                    <th className="px-4 py-2.5 font-medium">Linha</th>
                    <th className="px-4 py-2.5 font-medium">Erro</th>
                    <th className="px-4 py-2.5 font-medium">Recebido em</th>
                  </tr>
                </thead>
                <tbody>
                  {structuralErrorRows.map((row) => (
                    <tr key={row.id} className="border-b border-border-hairline last:border-0">
                      <td className="tabular px-4 py-2.5 text-ink-muted">#{row.row_number}</td>
                      <td className="px-4 py-2.5 text-denied">{row.raw_value || "Erro não identificado"}</td>
                      <td className="px-4 py-2.5 text-ink-muted">{formatDateTime(row.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </>
      )}

      <ResolveInsurancePlanModal
        key={resolvingGroup?.rawValue ?? "none"}
        isOpen={resolvingGroup !== null}
        onClose={() => setResolvingGroup(null)}
        group={resolvingGroup}
      />
    </div>
  );
}
