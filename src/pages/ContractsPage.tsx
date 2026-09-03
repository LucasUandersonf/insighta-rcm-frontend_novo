import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, ClipboardList, FileText, Plus, Sparkles } from "lucide-react";
import { Panel, EmptyState, LoadingState, ErrorState } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TextField, SelectField } from "@/components/ui/FormField";
import { Pagination } from "@/components/ui/Pagination";
import { PageHeader } from "@/components/ui/PageHeader";
import { apiClient, ApiError } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { useToast } from "@/context/ToastContext";
import type {
  Contract,
  ContractCreateRequest,
  ContractItemInput,
  ExtractedItem,
  ExtractionPreview,
  HomologateRequest,
  InsuranceCompany,
  InsuranceCompanyCreateRequest,
  InsurancePlan,
  InsurancePlanCreateRequest,
  PaginatedResponse,
} from "@/lib/types";

const CONTRACTS_PAGE_SIZE = 20;

function formatMoney(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));
}

const STATUS_LABELS: Record<Contract["status"], string> = {
  rascunho: "Rascunho (aguardando extração)",
  em_revisao: "Em revisão (conferir com IA)",
  homologado: "Homologado",
};

const STATUS_CLASSES: Record<Contract["status"], string> = {
  rascunho: "bg-canvas-raised text-ink-faint",
  em_revisao: "bg-pending-bg text-pending",
  homologado: "bg-revenue-bg text-revenue",
};

// ---------------------------------------------------------------------
// Convênios (Operadoras)
// ---------------------------------------------------------------------

function CreateCompanyModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [name, setName] = useState("");
  const [ansRegistry, setAnsRegistry] = useState("");
  const [appealDeadlineDays, setAppealDeadlineDays] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: (payload: InsuranceCompanyCreateRequest) =>
      apiClient.post<InsuranceCompany>("/api/v1/insurance-companies", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["insurance-companies"] });
      showSuccess("Operadora cadastrada com sucesso.");
      resetAndClose();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.campos) {
        const mapped: Record<string, string> = {};
        for (const c of err.campos) mapped[c.campo] = c.problema;
        setFieldErrors(mapped);
      } else {
        showError(getApiErrorMessage(err));
      }
    },
  });

  function resetAndClose() {
    setName("");
    setAnsRegistry("");
    setAppealDeadlineDays("");
    setFieldErrors({});
    onClose();
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    mutation.mutate({
      name,
      ans_registry: ansRegistry || null,
      default_appeal_deadline_days: appealDeadlineDays ? parseInt(appealDeadlineDays, 10) : null,
    });
  }

  return (
    <Modal title="Nova operadora" isOpen={isOpen} onClose={resetAndClose}>
      <form onSubmit={handleSubmit}>
        <TextField
          label="Nome da operadora"
          placeholder="Ex: Unimed Nacional"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={fieldErrors["name"]}
        />
        <TextField
          label="Registro ANS"
          value={ansRegistry}
          onChange={(e) => setAnsRegistry(e.target.value)}
          error={fieldErrors["ans_registry"]}
        />
        <TextField
          label="Prazo de recurso de glosa (dias)"
          type="number"
          min="1"
          placeholder="Ex: 30 — confira no contrato com a operadora"
          value={appealDeadlineDays}
          onChange={(e) => setAppealDeadlineDays(e.target.value)}
          error={fieldErrors["default_appeal_deadline_days"]}
        />
        <p className="mb-4 -mt-2 text-2xs text-ink-faint">
          Não é uma regra da ANS — é o prazo que consta no CONTRATO com esta operadora. Deixe em branco para usar o
          padrão geral até confirmar o número exato.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={resetAndClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Salvando..." : "Salvar operadora"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function CreatePlanModal({
  isOpen,
  onClose,
  companies,
}: {
  isOpen: boolean;
  onClose: () => void;
  companies: InsuranceCompany[];
}) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [companyId, setCompanyId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [ansRegistry, setAnsRegistry] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: (payload: InsurancePlanCreateRequest) =>
      apiClient.post<InsurancePlan>("/api/v1/insurance-companies/plans", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["insurance-plans"] });
      showSuccess("Plano cadastrado com sucesso.");
      resetAndClose();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.campos) {
        const mapped: Record<string, string> = {};
        for (const c of err.campos) mapped[c.campo] = c.problema;
        setFieldErrors(mapped);
      } else {
        showError(getApiErrorMessage(err));
      }
    },
  });

  function resetAndClose() {
    setCompanyId("");
    setDisplayName("");
    setAnsRegistry("");
    setFieldErrors({});
    onClose();
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    if (!companyId) {
      setFieldErrors({ insurance_company_id: "Selecione uma operadora." });
      return;
    }
    mutation.mutate({ insurance_company_id: companyId, display_name: displayName, ans_registry: ansRegistry || null });
  }

  return (
    <Modal title="Novo plano" isOpen={isOpen} onClose={resetAndClose}>
      <form onSubmit={handleSubmit}>
        <SelectField
          label="Operadora"
          required
          value={companyId}
          onChange={(e) => setCompanyId(e.target.value)}
          error={fieldErrors["insurance_company_id"]}
        >
          <option value="">Selecione...</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Nome do plano"
          placeholder="Ex: Unimed Nacional Empresarial"
          required
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          error={fieldErrors["display_name"]}
        />
        <TextField
          label="Registro ANS"
          value={ansRegistry}
          onChange={(e) => setAnsRegistry(e.target.value)}
          error={fieldErrors["ans_registry"]}
        />
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={resetAndClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Salvando..." : "Salvar plano"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------
// Cadastro manual de contrato (sem PDF/IA)
// ---------------------------------------------------------------------

function ManualContractModal({
  isOpen,
  onClose,
  plans,
}: {
  isOpen: boolean;
  onClose: () => void;
  plans: InsurancePlan[];
}) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [planId, setPlanId] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [items, setItems] = useState<ContractItemInput[]>([{ tuss_code: "", procedure_name: "", agreed_price: 0 }]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: (payload: ContractCreateRequest) => apiClient.post<Contract>("/api/v1/contracts", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      showSuccess("Contrato cadastrado e homologado com sucesso.");
      resetAndClose();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.campos) {
        const mapped: Record<string, string> = {};
        for (const c of err.campos) mapped[c.campo] = c.problema;
        setFieldErrors(mapped);
      } else {
        showError(getApiErrorMessage(err));
      }
    },
  });

  function resetAndClose() {
    setPlanId("");
    setValidFrom("");
    setValidUntil("");
    setItems([{ tuss_code: "", procedure_name: "", agreed_price: 0 }]);
    setFieldErrors({});
    onClose();
  }

  function updateItem(index: number, patch: Partial<ContractItemInput>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    if (!planId) {
      setFieldErrors({ insurance_plan_id: "Selecione um plano." });
      return;
    }
    mutation.mutate({
      insurance_plan_id: planId,
      valid_from: validFrom,
      valid_until: validUntil || null,
      items,
    });
  }

  return (
    <Modal title="Cadastro manual de contrato" isOpen={isOpen} onClose={resetAndClose} size="xl">
      <form onSubmit={handleSubmit}>
        <p className="mb-4 text-xs text-ink-faint">
          Para 1-2 procedimentos que você já sabe de cor. Se o contrato tem uma tabela de preços extensa em PDF,
          use “Enviar PDF (IA)” em vez disso — a IA lê o documento pra você.
        </p>
        <SelectField
          label="Plano"
          required
          value={planId}
          onChange={(e) => setPlanId(e.target.value)}
          error={fieldErrors["insurance_plan_id"]}
        >
          <option value="">Selecione...</option>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.display_name}
            </option>
          ))}
        </SelectField>
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Vigência a partir de"
            type="date"
            required
            value={validFrom}
            onChange={(e) => setValidFrom(e.target.value)}
            error={fieldErrors["valid_from"]}
          />
          <TextField
            label="Vigência até (opcional)"
            type="date"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
            error={fieldErrors["valid_until"]}
          />
        </div>

        <div className="mb-2 mt-4 flex items-center justify-between">
          <span className="text-xs font-medium text-ink-muted">Itens do contrato</span>
          <Button
            type="button"
            variant="ghost"
            className="!px-2 !py-1 text-xs"
            onClick={() => setItems((prev) => [...prev, { tuss_code: "", procedure_name: "", agreed_price: 0 }])}
          >
            + Adicionar item
          </Button>
        </div>
        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={index} className="grid grid-cols-[1fr_2fr_1fr_auto] gap-2">
              <input
                className="rounded-sm border border-border bg-canvas-raised px-2 py-1.5 text-sm text-ink"
                placeholder="Código TUSS"
                value={item.tuss_code}
                onChange={(e) => updateItem(index, { tuss_code: e.target.value })}
                required
              />
              <input
                className="rounded-sm border border-border bg-canvas-raised px-2 py-1.5 text-sm text-ink"
                placeholder="Descrição do procedimento"
                value={item.procedure_name ?? ""}
                onChange={(e) => updateItem(index, { procedure_name: e.target.value })}
              />
              <input
                className="rounded-sm border border-border bg-canvas-raised px-2 py-1.5 text-sm text-ink"
                placeholder="Valor (R$)"
                type="number"
                step="0.01"
                min="0.01"
                value={item.agreed_price || ""}
                onChange={(e) => updateItem(index, { agreed_price: parseFloat(e.target.value) || 0 })}
                required
              />
              <Button
                type="button"
                variant="ghost"
                className="!px-2 text-denied"
                disabled={items.length === 1}
                onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                aria-label="Remover item"
              >
                ✕
              </Button>
            </div>
          ))}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={resetAndClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Salvando..." : "Salvar e homologar"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------
// Upload de PDF (Parser Inteligente de Contratos)
// ---------------------------------------------------------------------

function UploadContractModal({
  isOpen,
  onClose,
  plans,
}: {
  isOpen: boolean;
  onClose: () => void;
  plans: InsurancePlan[];
}) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [planId, setPlanId] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: (formData: FormData) => apiClient.upload<Contract>("/api/v1/contracts/upload", formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      showSuccess("PDF enviado. Agora clique em “Extrair com IA” na linha do contrato para gerar a tabela de preços.");
      resetAndClose();
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  function resetAndClose() {
    setPlanId("");
    setValidFrom("");
    setValidUntil("");
    setFile(null);
    setFieldErrors({});
    onClose();
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    if (!planId) {
      setFieldErrors({ insurance_plan_id: "Selecione um plano." });
      return;
    }
    if (!file) {
      setFieldErrors({ file: "Selecione o PDF do contrato." });
      return;
    }
    const formData = new FormData();
    formData.append("insurance_plan_id", planId);
    formData.append("valid_from", validFrom);
    if (validUntil) formData.append("valid_until", validUntil);
    formData.append("file", file);
    mutation.mutate(formData);
  }

  return (
    <Modal title="Enviar PDF do contrato (IA)" isOpen={isOpen} onClose={resetAndClose}>
      <form onSubmit={handleSubmit}>
        <p className="mb-4 text-xs text-ink-faint">
          A IA lê o PDF e monta a tabela de preços pra você conferir antes de homologar — nada é salvo direto sem
          revisão humana.
        </p>
        <SelectField
          label="Plano"
          required
          value={planId}
          onChange={(e) => setPlanId(e.target.value)}
          error={fieldErrors["insurance_plan_id"]}
        >
          <option value="">Selecione...</option>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.display_name}
            </option>
          ))}
        </SelectField>
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Vigência a partir de"
            type="date"
            required
            value={validFrom}
            onChange={(e) => setValidFrom(e.target.value)}
          />
          <TextField
            label="Vigência até (opcional)"
            type="date"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
          />
        </div>
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-medium text-ink-muted">
            Arquivo PDF <span className="text-denied">*</span>
          </label>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-ink-muted file:mr-3 file:rounded-sm file:border-0 file:bg-canvas-raised file:px-3 file:py-1.5 file:text-xs file:text-ink"
          />
          {fieldErrors["file"] && <p className="mt-1 text-2xs text-denied">{fieldErrors["file"]}</p>}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={resetAndClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Enviando..." : "Enviar PDF"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------
// Tela de Conferência (Human-in-the-Loop) — extrair + homologar
// ---------------------------------------------------------------------

function ReviewContractModal({
  contract,
  onClose,
}: {
  contract: Contract | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [preview, setPreview] = useState<ExtractionPreview | null>(null);
  const [reviewItems, setReviewItems] = useState<ContractItemInput[]>([]);

  const extractMutation = useMutation({
    mutationFn: (contractId: string) => apiClient.post<ExtractionPreview>(`/api/v1/contracts/${contractId}/extract`),
    onSuccess: (data) => {
      setPreview(data);
      setReviewItems(
        data.items.map((i: ExtractedItem) => ({
          tuss_code: i.tuss_code,
          procedure_name: i.procedure_name,
          agreed_price: i.agreed_price,
        }))
      );
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  const homologateMutation = useMutation({
    mutationFn: ({ contractId, payload }: { contractId: string; payload: HomologateRequest }) =>
      apiClient.post<Contract>(`/api/v1/contracts/${contractId}/homologate`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      showSuccess("Contrato homologado — a tabela de preços já vale para o motor anti-glosa.");
      handleClose();
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  function handleClose() {
    setPreview(null);
    setReviewItems([]);
    onClose();
  }

  function updateItem(index: number, patch: Partial<ContractItemInput>) {
    setReviewItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  if (!contract) return null;

  const warningByCode = new Map((preview?.items ?? []).map((i) => [i.tuss_code, i.warning]));

  return (
    <Modal title="Conferência da extração por IA" isOpen={Boolean(contract)} onClose={handleClose} size="xl">
      {!preview && (
        <div className="py-6 text-center">
          <p className="mb-4 text-sm text-ink-muted">
            Este contrato ainda não foi extraído. Clique abaixo para a IA ler o PDF e propor a tabela de preços.
          </p>
          <Button onClick={() => extractMutation.mutate(contract.id)} disabled={extractMutation.isPending}>
            {extractMutation.isPending ? "Extraindo com IA..." : "Extrair com IA"}
          </Button>
          {extractMutation.isError && (
            <p className="mt-3 text-xs text-denied">{getApiErrorMessage(extractMutation.error)}</p>
          )}
        </div>
      )}

      {preview && (
        <div>
          {preview.warnings.length > 0 && (
            <div className="mb-3 rounded-sm border border-pending/30 bg-pending-bg px-3 py-2 text-xs text-pending">
              {preview.warnings.map((w, i) => (
                <p key={i}>{w}</p>
              ))}
            </div>
          )}
          <p className="mb-3 text-xs text-ink-faint">
            Confira e corrija os itens abaixo antes de homologar — só depois de “Salvar e homologar” a tabela passa a
            valer para o motor anti-glosa.
          </p>
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {reviewItems.map((item, index) => {
              const warning = warningByCode.get(item.tuss_code);
              return (
                <div key={index}>
                  <div className="grid grid-cols-[1fr_2fr_1fr_auto] gap-2">
                    <input
                      className="rounded-sm border border-border bg-canvas-raised px-2 py-1.5 text-sm text-ink"
                      value={item.tuss_code}
                      onChange={(e) => updateItem(index, { tuss_code: e.target.value })}
                    />
                    <input
                      className="rounded-sm border border-border bg-canvas-raised px-2 py-1.5 text-sm text-ink"
                      value={item.procedure_name ?? ""}
                      onChange={(e) => updateItem(index, { procedure_name: e.target.value })}
                    />
                    <input
                      className="rounded-sm border border-border bg-canvas-raised px-2 py-1.5 text-sm text-ink"
                      type="number"
                      step="0.01"
                      value={item.agreed_price}
                      onChange={(e) => updateItem(index, { agreed_price: parseFloat(e.target.value) || 0 })}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      className="!px-2 text-denied"
                      onClick={() => setReviewItems((prev) => prev.filter((_, i) => i !== index))}
                      aria-label="Remover item"
                    >
                      ✕
                    </Button>
                  </div>
                  {warning && <p className="mt-1 text-2xs text-pending">⚠ {warning}</p>}
                </div>
              );
            })}
          </div>
          <Button
            type="button"
            variant="ghost"
            className="mt-2 !px-2 !py-1 text-xs"
            onClick={() => setReviewItems((prev) => [...prev, { tuss_code: "", procedure_name: "", agreed_price: 0 }])}
          >
            + Adicionar item
          </Button>

          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={handleClose}>
              Cancelar
            </Button>
            <Button
              onClick={() =>
                homologateMutation.mutate({ contractId: contract.id, payload: { items: reviewItems } })
              }
              disabled={homologateMutation.isPending || reviewItems.length === 0}
            >
              {homologateMutation.isPending ? "Salvando..." : "Salvar e Homologar"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------

export function ContractsPage() {
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [reviewingContract, setReviewingContract] = useState<Contract | null>(null);
  const [contractsOffset, setContractsOffset] = useState(0);

  const { data: companies } = useQuery({
    queryKey: ["insurance-companies"],
    queryFn: () => apiClient.get<InsuranceCompany[]>("/api/v1/insurance-companies"),
  });

  const { data: plans } = useQuery({
    queryKey: ["insurance-plans"],
    queryFn: () => apiClient.get<InsurancePlan[]>("/api/v1/insurance-companies/plans"),
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
        `/api/v1/contracts/active?limit=${CONTRACTS_PAGE_SIZE}&offset=${contractsOffset}`
      ),
  });
  const contracts = contractsPage?.items;

  const planNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of plans ?? []) map.set(p.id, p.display_name);
    return map;
  }, [plans]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={FileText}
        title="Convênios e contratos"
        subtitle="Cadastre operadoras, planos e a tabela de preços contratada — a base de comparação do motor anti-glosa e do buraco financeiro."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-6">
          <Panel title="Operadoras" action={<Button variant="secondary" className="flex items-center gap-1 !px-2.5 !py-1 text-xs" onClick={() => setIsCompanyModalOpen(true)}><Plus size={12} />Nova operadora</Button>}>
            {(companies ?? []).length === 0 ? (
              <EmptyState icon={<Building2 size={17} strokeWidth={1.5} />} message="Nenhuma operadora cadastrada." />
            ) : (
              <ul className="divide-y divide-border-hairline">
                {(companies ?? []).map((c) => (
                  <li key={c.id} className="px-5 py-2.5 text-sm text-ink transition-colors hover:bg-canvas-raised/40">
                    {c.name}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="lg:col-span-6">
          <Panel title="Planos" action={<Button variant="secondary" className="flex items-center gap-1 !px-2.5 !py-1 text-xs" onClick={() => setIsPlanModalOpen(true)}><Plus size={12} />Novo plano</Button>}>
            {(plans ?? []).length === 0 ? (
              <EmptyState icon={<ClipboardList size={17} strokeWidth={1.5} />} message="Nenhum plano cadastrado." />
            ) : (
              <ul className="divide-y divide-border-hairline">
                {(plans ?? []).map((p) => (
                  <li key={p.id} className="px-5 py-2.5 text-sm text-ink transition-colors hover:bg-canvas-raised/40">
                    {p.display_name}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      <Panel
        title="Contratos"
        action={
          <div className="flex gap-2">
            <Button variant="secondary" className="flex items-center gap-1 !px-2.5 !py-1 text-xs" onClick={() => setIsManualModalOpen(true)}>
              <Plus size={12} />
              Cadastro manual
            </Button>
            <Button className="flex items-center gap-1 !px-2.5 !py-1 text-xs" onClick={() => setIsUploadModalOpen(true)}>
              <Sparkles size={12} />
              Enviar PDF (IA)
            </Button>
          </div>
        }
      >
        {contractsLoading && <LoadingState variant="table" rows={4} />}
        {contractsError && (
          <ErrorState message={getApiErrorMessage(contractsError)} onRetry={() => refetchContracts()} />
        )}
        {!contractsLoading && !contractsError && (contracts ?? []).length === 0 && (
          <EmptyState icon={<FileText size={17} strokeWidth={1.5} />} message="Nenhum contrato cadastrado ainda." />
        )}
        {!contractsLoading && (contracts ?? []).length > 0 && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border-hairline text-2xs uppercase tracking-wide text-ink-faint">
                <th className="px-4 py-2.5 font-medium">Plano</th>
                <th className="px-4 py-2.5 font-medium">Vigência</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Itens</th>
                <th className="px-4 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {(contracts ?? []).map((c) => (
                <tr key={c.id} className="border-b border-border-hairline last:border-0 transition-colors hover:bg-canvas-raised/60">
                  <td className="px-4 py-2.5 text-ink">{planNameById.get(c.insurance_plan_id) ?? c.insurance_plan_id}</td>
                  <td className="px-4 py-2.5 text-ink-muted">
                    {formatDate(c.valid_from)} {c.valid_until ? `– ${formatDate(c.valid_until)}` : "(sem fim)"}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full border border-transparent px-2 py-0.5 text-2xs font-medium ${STATUS_CLASSES[c.status]}`}>
                      {STATUS_LABELS[c.status]}
                    </span>
                  </td>
                  <td className="tabular px-4 py-2.5 text-ink-muted">
                    {c.items.length > 0
                      ? `${c.items.length} item(ns) — ${formatMoney(c.items.reduce((sum, i) => sum + i.agreed_price, 0))}`
                      : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {c.status !== "homologado" && c.pdf_s3_key && (
                      <Button variant="secondary" className="!px-2 !py-1 text-xs" onClick={() => setReviewingContract(c)}>
                        Extrair / Conferir
                      </Button>
                    )}
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
          />
        )}
      </Panel>

      <CreateCompanyModal isOpen={isCompanyModalOpen} onClose={() => setIsCompanyModalOpen(false)} />
      <CreatePlanModal isOpen={isPlanModalOpen} onClose={() => setIsPlanModalOpen(false)} companies={companies ?? []} />
      <ManualContractModal isOpen={isManualModalOpen} onClose={() => setIsManualModalOpen(false)} plans={plans ?? []} />
      <UploadContractModal isOpen={isUploadModalOpen} onClose={() => setIsUploadModalOpen(false)} plans={plans ?? []} />
      <ReviewContractModal contract={reviewingContract} onClose={() => setReviewingContract(null)} />
    </div>
  );
}
