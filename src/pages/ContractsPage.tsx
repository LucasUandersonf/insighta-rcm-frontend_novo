import { DenialModelStatusNote } from "@/components/dashboard/DenialModelStatusNote";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Building2, ClipboardList, FileText, Plus, Sparkles } from "lucide-react";
import { Panel, EmptyState, LoadingState, ErrorState } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/Pagination";
import { PageHeader } from "@/components/ui/PageHeader";
import { PeriodWindowSelect } from "@/components/ui/PeriodWindowSelect";
import { Tabs, TabPanel } from "@/components/ui/Tabs";
import { PayerOverviewPanel } from "@/components/payers/PayerOverviewPanel";
import { PlanLossRankingPanel } from "@/components/dashboard/PlanLossRankingPanel";
import { DenialRiskDistributionPanel } from "@/components/dashboard/DenialRiskDistributionPanel";
import { WithholdingPanel } from "@/components/money/WithholdingPanel";
import { DossierButton } from "@/components/money/DossierButton";
import { PayerSimulatorPanel } from "@/components/money/PayerSimulatorPanel";
import { PaymentLagPanel } from "@/components/dashboard/PaymentLagPanel";
import { useDateWindow } from "@/lib/useDateWindow";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { useToast } from "@/context/ToastContext";
import type { Contract, InsuranceCompany, InsurancePlan, PaginatedResponse } from "@/lib/types";
import { CreateConvenioModal, CreateCompanyModal, CreatePlanModal } from "@/components/contracts/RegistrationModals";
import { ManualContractModal, UploadContractModal, ReviewContractModal } from "@/components/contracts/ContractModals";
import { formatMoney, formatDate, STATUS_LABELS, STATUS_TONE } from "@/components/contracts/shared";
// extractionPagesNote continua exportado daqui (testes e quem já importava).
export { extractionPagesNote } from "@/components/contracts/ContractModals";


// Desativação (não exclusão) de Operadoras/Planos — achado do usuário:
// um convênio/plano cadastrado errado ou duplicado não tinha NENHUMA
// forma de sair do cadastro, mesmo sendo referenciado por
// Contract/Appointment/Billing (exclusão de verdade quebraria essas
// FKs, ver DECISÃO no backend em app/sql/014_insurance_is_active.sql).
// Mesmo padrão de Professional/User: `is_active` + PATCH.

const CONTRACTS_PAGE_SIZE = 20;

const PAYER_TABS_GROUP = "convenios";
type PayerTabId = "visao-geral" | "glosas" | "prazos" | "simulador" | "contratos";
const PAYER_TAB_IDS: PayerTabId[] = [
  "visao-geral",
  "glosas",
  "prazos",
  "simulador",
  "contratos",
];
const PAYER_WINDOW_OPTIONS = [
  { days: 30, label: "Últimos 30 dias" },
  { days: 90, label: "Últimos 90 dias" },
  { days: 180, label: "Últimos 180 dias" },
];

/**
 * Convênios (canvas "Insighta RCM — Redesign 2026", artboard "Convênios")
 * — "Visão geral" (veredictos, desempenho por convênio com leitura,
 * simulação de prazo), "Glosas", "Prazos e retenções" e "Contratos e
 * tabelas" (o cadastro de operadoras/planos/contratos de sempre).
 * `?tab=` na URL abre direto numa aba.
 */
/** Contrato enviado por engano (PDF errado) — só em rascunho (rodada 4, B5). */
function DeleteDraftContractButton({ contractId }: { contractId: string }) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const removal = useMutation({
    mutationFn: () => apiClient.delete<void>(`/api/v1/contracts/${contractId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      showSuccess("Contrato excluído.");
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });
  return (
    <Button
      variant="ghost"
      size="xs"
      className="text-denied"
      disabled={removal.isPending}
      onClick={() => {
        if (
          window.confirm(
            "Excluir este contrato em rascunho? O PDF enviado é apagado.",
          )
        )
          removal.mutate();
      }}
    >
      Excluir
    </Button>
  );
}

export function ContractsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<PayerTabId>(() => {
    const tab = searchParams.get("tab");
    return tab && (PAYER_TAB_IDS as string[]).includes(tab)
      ? (tab as PayerTabId)
      : "visao-geral";
  });
  // UX3-18: a aba fica no endereço — voltar do navegador reabre a mesma aba.
  function selectTab(id: PayerTabId) {
    setActiveTab(id);
    const next = new URLSearchParams(searchParams);
    if (id === "visao-geral") next.delete("tab");
    else next.set("tab", id);
    setSearchParams(next, { replace: true });
  }
  const tabParam = searchParams.get("tab");
  useEffect(() => {
    const fromUrl = tabParam && (PAYER_TAB_IDS as string[]).includes(tabParam) ? (tabParam as PayerTabId) : "visao-geral";
    setActiveTab(fromUrl);
  }, [tabParam]);
  const { windowDays, setWindowDays, dateFrom, dateTo, dataUntil } = useDateWindow(90);
  const queryClient = useQueryClient();
  const { showError } = useToast();
  const [isConvenioModalOpen, setIsConvenioModalOpen] = useState(false);
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [reviewingContract, setReviewingContract] = useState<Contract | null>(
    null,
  );
  const [contractsOffset, setContractsOffset] = useState(0);

  // UX2-13: vindo de Importar dados › Contratos, "?conferir=<id>" abre a
  // conferência do contrato recém-enviado (e a leitura começa sozinha).
  const conferirId = searchParams.get("conferir");
  const conferirQuery = useQuery({
    queryKey: ["contracts", "detail", conferirId],
    queryFn: () => apiClient.get<Contract>(`/api/v1/contracts/${conferirId}`),
    enabled: Boolean(conferirId),
    staleTime: Infinity,
  });
  const openedConferir = useRef(false);
  useEffect(() => {
    if (openedConferir.current || !conferirQuery.data) return;
    openedConferir.current = true;
    setReviewingContract(conferirQuery.data);
    const next = new URLSearchParams(searchParams);
    next.delete("conferir");
    setSearchParams(next, { replace: true });
  }, [conferirQuery.data, searchParams, setSearchParams]);

  // Ativos apenas — alimenta os SELECTs de "operadora"/"plano" nos
  // formulários de cadastro novo (Novo plano, Cadastro manual, Enviar
  // PDF). Não faz sentido criar um plano novo sob uma operadora
  // desativada, nem homologar contrato novo contra um plano desativado.
  const { data: companies } = useQuery({
    queryKey: ["insurance-companies"],
    queryFn: () =>
      apiClient.get<InsuranceCompany[]>("/api/v1/insurance-companies"),
  });

  const { data: plans } = useQuery({
    queryKey: ["insurance-plans"],
    queryFn: () =>
      apiClient.get<InsurancePlan[]>("/api/v1/insurance-companies/plans"),
  });

  // Ativos + inativos — alimenta os PAINÉIS de gestão abaixo (precisa
  // mostrar o que foi desativado, para poder reativar) e a resolução de
  // nome de plano na tabela de Contratos (um contrato antigo não deveria
  // "perder" o nome do plano na tela só porque o plano foi desativado
  // depois). Mesmo par active/all de ProfessionalRepository no backend.
  const { data: allCompanies } = useQuery({
    queryKey: ["insurance-companies", "all"],
    queryFn: () =>
      apiClient.get<InsuranceCompany[]>(
        "/api/v1/insurance-companies?include_inactive=true",
      ),
  });

  const { data: allPlans } = useQuery({
    queryKey: ["insurance-plans", "all"],
    queryFn: () =>
      apiClient.get<InsurancePlan[]>(
        "/api/v1/insurance-companies/plans?include_inactive=true",
      ),
  });

  const toggleCompanyActiveMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      apiClient.patch<InsuranceCompany>(`/api/v1/insurance-companies/${id}`, {
        is_active,
      }),
    // Invalida o prefixo inteiro — pega tanto ["insurance-companies"]
    // (ativos, usado pelos SELECTs) quanto ["insurance-companies","all"]
    // (painel de gestão) numa chamada só.
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["insurance-companies"] }),
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  const togglePlanActiveMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      apiClient.patch<InsurancePlan>(
        `/api/v1/insurance-companies/plans/${id}`,
        { is_active },
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["insurance-plans"] }),
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  const {
    data: contractsPage,
    isLoading: contractsLoading,
    error: contractsError,
    refetch: refetchContracts,
  } = useQuery({
    queryKey: ["contracts", contractsOffset],
    queryFn: () =>
      apiClient.get<PaginatedResponse<Contract>>(
        `/api/v1/contracts/active?limit=${CONTRACTS_PAGE_SIZE}&offset=${contractsOffset}`,
      ),
  });
  const contracts = contractsPage?.items;

  // Mesmo mecanismo de "atenção" da Sala de Comando (glow por estado
  // real, nunca decorativo): um contrato "em_revisao" precisa de alguém
  // conferir a extração da IA antes de homologar — vale destacar o card,
  // não só a pílula da linha.
  const hasContractAwaitingReview = (contracts ?? []).some(
    (c) => c.status === "em_revisao",
  );

  const planNameById = useMemo(() => {
    const map = new Map<string, string>();
    // `allPlans` (ativos + inativos) — um contrato antigo não deveria
    // "perder" o nome do plano na tabela só porque o plano foi
    // desativado depois de homologado.
    for (const p of allPlans ?? []) map.set(p.id, p.display_name);
    return map;
  }, [allPlans]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={FileText}
        title="Convênios"
        subtitle="Quem paga bem, quem glosa e quem segura seu caixa."
        action={
          activeTab !== "contratos" ? (
            <PeriodWindowSelect
              windowDays={windowDays}
              onChange={setWindowDays}
              dataUntil={dataUntil}
              options={PAYER_WINDOW_OPTIONS}
            />
          ) : undefined
        }
      />

      <Tabs
        groupId={PAYER_TABS_GROUP}
        active={activeTab}
        onChange={(id) => selectTab(id as PayerTabId)}
        items={[
          { id: "visao-geral", label: "Visão geral" },
          { id: "glosas", label: "Glosas" },
          { id: "prazos", label: "Prazos e retenções" },
          { id: "simulador", label: "Simulador" },
          { id: "contratos", label: "Contratos e tabelas" },
        ]}
      />

      {activeTab === "visao-geral" && (
        <TabPanel id="visao-geral" groupId={PAYER_TABS_GROUP}>
          <PayerOverviewPanel dateFrom={dateFrom} dateTo={dateTo} />
        </TabPanel>
      )}
      {activeTab === "glosas" && (
        <TabPanel id="glosas" groupId={PAYER_TABS_GROUP}>
          <div className="space-y-6">
            <DenialModelStatusNote />
            <PlanLossRankingPanel dateFrom={dateFrom} dateTo={dateTo} />
            <DenialRiskDistributionPanel dateFrom={dateFrom} dateTo={dateTo} />
          </div>
        </TabPanel>
      )}
      {activeTab === "prazos" && (
        <TabPanel id="prazos" groupId={PAYER_TABS_GROUP}>
          <div className="space-y-6">
            <PaymentLagPanel dateFrom={dateFrom} dateTo={dateTo} />
            <WithholdingPanel />
          </div>
        </TabPanel>
      )}

      {activeTab === "simulador" && (
        <TabPanel id="simulador" groupId={PAYER_TABS_GROUP}>
          <PayerSimulatorPanel />
        </TabPanel>
      )}

      {activeTab === "contratos" && (
        <TabPanel id="contratos" groupId={PAYER_TABS_GROUP}>
          <div className="space-y-6">
            <Panel
              title="Convênios"
              subtitle="Os convênios e o particular que a clínica atende. Convênio novo que aparece numa planilha importada é cadastrado sozinho."
              action={
                <Button
                  size="xs"
                  className="flex items-center gap-1"
                  onClick={() => setIsConvenioModalOpen(true)}
                >
                  <Plus size={12} />
                  Novo convênio
                </Button>
              }
            >
              {(allPlans ?? []).length === 0 ? (
                <EmptyState
                  icon={<ClipboardList size={17} strokeWidth={1.5} />}
                  message="Nenhum convênio cadastrado ainda. Cadastre aqui ou importe uma planilha — os convênios dela entram sozinhos."
                />
              ) : (
                <ul className="divide-y divide-border-hairline">
                  {(allPlans ?? []).map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between gap-2 px-5 py-2.5 text-sm text-ink"
                    >
                      <span className={p.is_active ? undefined : "text-ink-faint"}>
                        {p.display_name}
                      </span>
                      <div className="flex items-center gap-2">
                        {p.plan_type === "particular" && (
                          <Badge tone="accent">Particular</Badge>
                        )}
                        {!p.is_active && <Badge tone="neutral">Desativado</Badge>}
                        {p.plan_type !== "particular" && <DossierButton planId={p.id} planName={p.display_name} />}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <details className="rounded-lg border border-border-hairline">
              <summary className="cursor-pointer px-5 py-3 text-sm font-medium text-ink">
                Operadoras e planos (avançado)
              </summary>
              <p className="px-5 pb-3 text-xs text-ink-muted">
                Só é preciso aqui quando uma operadora tem vários planos com regras diferentes,
                ou para desativar um convênio.
              </p>
            <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-12">
              <div className="lg:col-span-6">
                <Panel
                  title="Operadoras"
                  action={
                    <Button
                      variant="secondary"
                      size="xs"
                      className="flex items-center gap-1"
                      onClick={() => setIsCompanyModalOpen(true)}
                    >
                      <Plus size={12} />
                      Nova operadora
                    </Button>
                  }
                >
                  {(allCompanies ?? []).length === 0 ? (
                    <EmptyState
                      icon={<Building2 size={17} strokeWidth={1.5} />}
                      message="Nenhuma operadora cadastrada."
                    />
                  ) : (
                    <ul className="divide-y divide-border-hairline">
                      {(allCompanies ?? []).map((c) => (
                        <li
                          key={c.id}
                          className="flex items-center justify-between gap-2 px-5 py-2.5 text-sm text-ink transition-colors hover:bg-canvas-raised/40"
                        >
                          <span
                            className={
                              c.is_active ? undefined : "text-ink-faint"
                            }
                          >
                            {c.name}
                          </span>
                          <div className="flex items-center gap-2">
                            {!c.is_active && (
                              <Badge tone="neutral">Inativa</Badge>
                            )}
                            <Button
                              variant="ghost"
                              size="xs"
                              disabled={toggleCompanyActiveMutation.isPending}
                              onClick={() =>
                                toggleCompanyActiveMutation.mutate({
                                  id: c.id,
                                  is_active: !c.is_active,
                                })
                              }
                            >
                              {c.is_active ? "Desativar" : "Reativar"}
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
              </div>

              <div className="lg:col-span-6">
                <Panel
                  title="Planos"
                  action={
                    <Button
                      variant="secondary"
                      size="xs"
                      className="flex items-center gap-1"
                      onClick={() => setIsPlanModalOpen(true)}
                    >
                      <Plus size={12} />
                      Novo plano
                    </Button>
                  }
                >
                  {(allPlans ?? []).length === 0 ? (
                    <EmptyState
                      icon={<ClipboardList size={17} strokeWidth={1.5} />}
                      message="Nenhum plano cadastrado."
                    />
                  ) : (
                    <ul className="divide-y divide-border-hairline">
                      {(allPlans ?? []).map((p) => (
                        <li
                          key={p.id}
                          className="flex items-center justify-between gap-2 px-5 py-2.5 text-sm text-ink transition-colors hover:bg-canvas-raised/40"
                        >
                          <span
                            className={
                              p.is_active ? undefined : "text-ink-faint"
                            }
                          >
                            {p.display_name}
                          </span>
                          <div className="flex items-center gap-2">
                            {/* Achado do Plano de Ação Insighta (Onda 3) —
                          "particular" é o vocabulário fechado que
                          segrega paciente sem operadora do resto da
                          analytics. */}
                            {p.plan_type === "particular" && (
                              <Badge tone="accent">Particular</Badge>
                            )}
                            {!p.is_active && (
                              <Badge tone="neutral">Inativo</Badge>
                            )}
                            <Button
                              variant="ghost"
                              size="xs"
                              disabled={togglePlanActiveMutation.isPending}
                              onClick={() =>
                                togglePlanActiveMutation.mutate({
                                  id: p.id,
                                  is_active: !p.is_active,
                                })
                              }
                            >
                              {p.is_active ? "Desativar" : "Reativar"}
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
              </div>
            </div>
            </details>

            <Panel
              title="Contratos"
              glow={hasContractAwaitingReview ? "pending" : "none"}
              action={
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="xs"
                    className="flex items-center gap-1"
                    onClick={() => setIsManualModalOpen(true)}
                  >
                    <Plus size={12} />
                    Cadastro manual
                  </Button>
                  <Button
                    size="xs"
                    className="flex items-center gap-1"
                    onClick={() => setIsUploadModalOpen(true)}
                  >
                    <Sparkles size={12} />
                    Enviar contrato (PDF)
                  </Button>
                </div>
              }
            >
              {contractsLoading && <LoadingState variant="table" rows={4} />}
              {contractsError && (
                <ErrorState
                  message={getApiErrorMessage(contractsError)}
                  onRetry={() => refetchContracts()}
                />
              )}
              {!contractsLoading &&
                !contractsError &&
                (contracts ?? []).length === 0 && (
                  <EmptyState
                    icon={<FileText size={17} strokeWidth={1.5} />}
                    message="Nenhum contrato cadastrado ainda."
                  />
                )}
              {!contractsLoading && (contracts ?? []).length > 0 && (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border-hairline text-xs font-medium text-ink-muted">
                      <th className="px-4 py-2.5 font-medium">Convênio</th>
                      <th className="px-4 py-2.5 font-medium">Vigência</th>
                      <th className="px-4 py-2.5 font-medium">Status</th>
                      <th className="px-4 py-2.5 font-medium">Itens</th>
                      <th className="px-4 py-2.5 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(contracts ?? []).map((c) => (
                      <tr
                        key={c.id}
                        className="border-b border-border-hairline last:border-0 transition-colors hover:bg-canvas-raised/60"
                      >
                        <td className="px-4 py-2.5 text-ink">
                          {planNameById.get(c.insurance_plan_id) ??
                            c.insurance_plan_id}
                        </td>
                        <td className="px-4 py-2.5 text-ink-muted">
                          {formatDate(c.valid_from)}{" "}
                          {c.valid_until
                            ? `– ${formatDate(c.valid_until)}`
                            : "(sem fim)"}
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge tone={STATUS_TONE[c.status]}>
                            {STATUS_LABELS[c.status]}
                          </Badge>
                        </td>
                        <td className="tabular px-4 py-2.5 text-ink-muted">
                          {c.items.length > 0
                            ? `${c.items.length} item(ns) — ${formatMoney(c.items.reduce((sum, i) => sum + i.agreed_price, 0))}`
                            : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex justify-end gap-2">
                            {c.status !== "homologado" && c.pdf_s3_key && (
                              <Button
                                variant="secondary"
                                size="xs"
                                onClick={() => setReviewingContract(c)}
                              >
                                {c.status === "rascunho" ? "Ler tabela de preços" : "Conferir tabela"}
                              </Button>
                            )}
                            {c.status === "rascunho" && (
                              <DeleteDraftContractButton contractId={c.id} />
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {contractsPage && contractsPage.total > 0 && (
                <Pagination
                  total={contractsPage.total}
                  limit={CONTRACTS_PAGE_SIZE}
                  offset={contractsOffset}
                  onOffsetChange={setContractsOffset}
                  label="Paginação de contratos"
                />
              )}
            </Panel>
          </div>
        </TabPanel>
      )}

      <CreateConvenioModal
        isOpen={isConvenioModalOpen}
        onClose={() => setIsConvenioModalOpen(false)}
      />
      <CreateCompanyModal
        isOpen={isCompanyModalOpen}
        onClose={() => setIsCompanyModalOpen(false)}
      />
      <CreatePlanModal
        isOpen={isPlanModalOpen}
        onClose={() => setIsPlanModalOpen(false)}
        companies={companies ?? []}
      />
      <ManualContractModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        plans={plans ?? []}
      />
      <UploadContractModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        plans={plans ?? []}
        onUploaded={(contract) => setReviewingContract(contract)}
      />
      <ReviewContractModal
        contract={reviewingContract}
        planName={
          reviewingContract
            ? planNameById.get(reviewingContract.insurance_plan_id)
            : undefined
        }
        onClose={() => setReviewingContract(null)}
      />
    </div>
  );
}

