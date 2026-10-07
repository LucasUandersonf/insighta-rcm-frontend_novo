import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ListChecks, TriangleAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { Panel, EmptyState, LoadingState, ErrorState } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { ImportDataNav } from "@/components/layout/ImportDataNav";
import { UnknownPlanActions } from "@/components/ingestion/UnknownPlanActions";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { useToast } from "@/context/ToastContext";
import type { RejectedRow, UnknownPlanGroup } from "@/lib/types";

// Linhas para corrigir — o que a importação não conseguiu trazer sozinha.
//
// Auditoria de UX:
//   - UX-05: os convênios vêm agrupados e CONTADOS no servidor
//     (GET /ingestion/rejected/unknown-plans); antes a tela agrupava só as
//     200 primeiras linhas e mostrava "36 lançamentos" onde havia 1.968.
//   - UX-06/UX-07: cada convênio se resolve aqui mesmo — cadastrar com o
//     nome do arquivo ou dizer que é outro nome de um convênio que a
//     clínica já tem (UnknownPlanActions), sem ir a Contratos.
//   - UX-08: "Resolver automaticamente" traz de uma vez todos os nomes
//     que já batem com um convênio cadastrado.
//   - Linhas com dado inválido mostram o número da linha COMO NA PLANILHA
//     (cabeçalho é a linha 1) e o motivo em texto simples.

const STRUCTURAL_LIMIT = 200;

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
}

function formatMoney(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

function linhas(n: number): string {
  return `${n.toLocaleString("pt-BR")} ${n === 1 ? "linha" : "linhas"}`;
}

export function SetupPage() {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();

  const unknownPlans = useQuery({
    queryKey: ["rejected-unknown-plans"],
    queryFn: () => apiClient.get<UnknownPlanGroup[]>("/api/v1/ingestion/rejected/unknown-plans"),
  });

  const rejected = useQuery({
    queryKey: ["rejected-rows"],
    queryFn: () => apiClient.get<RejectedRow[]>(`/api/v1/ingestion/rejected?limit=${STRUCTURAL_LIMIT}`),
  });

  const autoResolve = useMutation({
    mutationFn: () =>
      apiClient.post<{ resolved: number; names: string[]; message: string }>(
        "/api/v1/ingestion/rejected/auto-resolve",
        {},
        { timeoutMs: 5 * 60_000 }
      ),
    onSuccess: (result) => {
      queryClient.invalidateQueries();
      showSuccess(result.message);
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  const structuralErrorRows = useMemo(
    () => (rejected.data ?? []).filter((r) => r.reason !== "unknown_insurance_plan"),
    [rejected.data]
  );

  const groups = unknownPlans.data ?? [];
  const totalUnknown = groups.reduce((sum, g) => sum + g.count, 0);
  const isLoading = unknownPlans.isLoading || rejected.isLoading;
  const error = unknownPlans.error ?? rejected.error;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ListChecks}
        title="Importar dados"
        subtitle="Linhas que a importação não conseguiu trazer sozinha. Resolva os convênios aqui; linhas com dado inválido precisam ser corrigidas na planilha e enviadas de novo."
      />

      <ImportDataNav />

      {isLoading && <LoadingState variant="table" rows={4} />}
      {error && !isLoading && (
        <ErrorState
          message={getApiErrorMessage(error)}
          onRetry={() => {
            unknownPlans.refetch();
            rejected.refetch();
          }}
        />
      )}

      {!isLoading && !error && (
        <>
          <Panel
            title="Convênios não cadastrados"
            subtitle={
              groups.length > 0
                ? `${linhas(totalUnknown)} esperando: o convênio escrito na planilha não existe na clínica. Cadastre o convênio ou diga qual é — todas as linhas com o mesmo nome entram de uma vez.`
                : "Quando a planilha traz um convênio que a clínica não tem, as linhas dele aparecem aqui."
            }
            glow={groups.length > 0 ? "pending" : "none"}
            actions={
              groups.length > 0 ? (
                <Button
                  type="button"
                  size="xs"
                  variant="secondary"
                  disabled={autoResolve.isPending}
                  onClick={() => autoResolve.mutate()}
                >
                  {autoResolve.isPending ? "Resolvendo…" : "Resolver automaticamente"}
                </Button>
              ) : undefined
            }
          >
            {groups.length === 0 && (
              <EmptyState
                icon={<ListChecks size={17} strokeWidth={1.5} />}
                message="Nenhum convênio esperando cadastro."
              />
            )}
            {groups.length > 0 && (
              <ul className="divide-y divide-border-hairline">
                {groups.map((group) => (
                  <li key={group.raw_value} className="flex flex-col gap-2 px-4 py-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                        {group.raw_value || "Convênio em branco"}
                        <Badge tone="pending">{linhas(group.count)}</Badge>
                      </p>
                      <p className="mt-0.5 text-xs text-ink-muted">
                        {group.samples
                          .slice(0, 3)
                          .map((s) =>
                            [s.patient_name, formatMoney(s.charged_value)].filter(Boolean).join(" — ")
                          )
                          .filter(Boolean)
                          .join(" · ")}
                        {group.count > 3 ? ` · e mais ${linhas(group.count - 3)}` : ""}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-muted">Recebido em {formatDateTime(group.last_received_at)}</p>
                    </div>
                    <div className="shrink-0">
                      <UnknownPlanActions
                        rawValue={group.raw_value}
                        suggestedPlanId={group.suggested_plan_id}
                        suggestedPlanName={group.suggested_plan_name}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            title="Linhas com dado inválido"
            subtitle="Data, valor ou campo obrigatório que não deu para ler. Corrija essas linhas na planilha e envie o arquivo de novo — só as linhas que faltavam entram."
            glow={structuralErrorRows.length > 0 ? "denied" : "none"}
          >
            {structuralErrorRows.length === 0 && (
              <EmptyState
                icon={<TriangleAlert size={17} strokeWidth={1.5} />}
                message="Nenhuma linha com dado inválido."
              />
            )}
            {structuralErrorRows.length > 0 && (
              <>
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border-hairline text-xs text-ink-muted">
                      <th className="px-4 py-2.5 font-medium">Linha da planilha</th>
                      <th className="px-4 py-2.5 font-medium">O que corrigir</th>
                      <th className="px-4 py-2.5 font-medium">Recebido em</th>
                    </tr>
                  </thead>
                  <tbody>
                    {structuralErrorRows.map((row) => (
                      <tr key={row.id} className="border-b border-border-hairline last:border-0">
                        <td className="tabular px-4 py-2.5 text-ink-muted">Linha {row.row_number + 1}</td>
                        <td className="px-4 py-2.5 text-ink">{row.raw_value || "Dado não reconhecido"}</td>
                        <td className="px-4 py-2.5 text-ink-muted">{formatDateTime(row.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="px-4 py-3 text-xs text-ink-muted">
                  Depois de corrigir, envie a planilha de novo em{" "}
                  <Link to="/importar" className="text-accent underline-offset-2 hover:underline">
                    Enviar arquivos
                  </Link>
                  .
                </p>
              </>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
