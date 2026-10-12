import { DenialModelStatusNote } from "@/components/dashboard/DenialModelStatusNote";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  Building2,
  ClipboardList,
  FileText,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import {
  Panel,
  EmptyState,
  LoadingState,
  ErrorState,
} from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { TextField, SelectField } from "@/components/ui/FormField";
import { Pagination } from "@/components/ui/Pagination";
import { PageHeader } from "@/components/ui/PageHeader";
import { PeriodWindowSelect } from "@/components/ui/PeriodWindowSelect";
import { Tabs, TabPanel } from "@/components/ui/Tabs";
import { PayerOverviewPanel } from "@/components/payers/PayerOverviewPanel";
import { PlanLossRankingPanel } from "@/components/dashboard/PlanLossRankingPanel";
import { DenialRiskDistributionPanel } from "@/components/dashboard/DenialRiskDistributionPanel";
import { PaymentLagPanel } from "@/components/dashboard/PaymentLagPanel";
import { useDateWindow } from "@/lib/useDateWindow";
import { cn } from "@/lib/cn";
import { apiClient, ApiError } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { useToast } from "@/context/ToastContext";
import type {
  AiGenerationJob,
  AiGenerationJobEnqueuedResponse,
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
  InsurancePlanType,
  PaginatedResponse,
} from "@/lib/types";
import { MoneyInput } from "@/components/ui/MoneyField";
import { formatDateBR } from "@/lib/dates";

// Desativação (não exclusão) de Operadoras/Planos — achado do usuário:
// um convênio/plano cadastrado errado ou duplicado não tinha NENHUMA
// forma de sair do cadastro, mesmo sendo referenciado por
// Contract/Appointment/Billing (exclusão de verdade quebraria essas
// FKs, ver DECISÃO no backend em app/sql/014_insurance_is_active.sql).
// Mesmo padrão de Professional/User: `is_active` + PATCH.

const CONTRACTS_PAGE_SIZE = 20;

function formatMoney(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatDate(iso: string): string {
  return formatDateBR(iso, { day: "2-digit", month: "2-digit", year: "numeric", });
}

const STATUS_LABELS: Record<Contract["status"], string> = {
  rascunho: "Rascunho (tabela ainda não lida)",
  em_revisao: "Em conferência",
  homologado: "Tabela aprovada",
};

const STATUS_TONE: Record<Contract["status"], BadgeTone> = {
  rascunho: "neutral",
  em_revisao: "pending",
  homologado: "revenue",
};

// ---------------------------------------------------------------------
// Convênios (Operadoras)
// ---------------------------------------------------------------------

// UX-07: para a clínica, "Unimed" é um convênio — um formulário só. A
// operadora é criada junto (particular não tem); operadora e plano
// separados ficam em "Operadoras e planos (avançado)".
function CreateConvenioModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [name, setName] = useState("");
  const [isParticular, setIsParticular] = useState(false);
  const [ansRegistry, setAnsRegistry] = useState("");
  const [appealDeadlineDays, setAppealDeadlineDays] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: (payload: {
      name: string;
      plan_type: InsurancePlanType;
      ans_registry: string | null;
      default_appeal_deadline_days: number | null;
    }) =>
      apiClient.post<{ plan: InsurancePlan; resolved_rows: number }>(
        "/api/v1/insurance-companies/convenios",
        payload,
      ),
    onSuccess: (result) => {
      queryClient.invalidateQueries();
      const extra =
        result.resolved_rows > 0
          ? ` ${result.resolved_rows.toLocaleString("pt-BR")} ${result.resolved_rows === 1 ? "linha importada que esperava por ele entrou" : "linhas importadas que esperavam por ele entraram"} no sistema.`
          : "";
      showSuccess(`Convênio “${result.plan.display_name}” cadastrado.${extra}`);
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
    setIsParticular(false);
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
      plan_type: isParticular ? "particular" : "convenio",
      ans_registry: isParticular ? null : ansRegistry || null,
      default_appeal_deadline_days:
        !isParticular && appealDeadlineDays ? parseInt(appealDeadlineDays, 10) : null,
    });
  }

  return (
    <Modal title="Novo convênio" isOpen={isOpen} onClose={resetAndClose}>
      <form onSubmit={handleSubmit}>
        <TextField
          label="Nome do convênio"
          placeholder="Ex.: Unimed Nacional"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={fieldErrors["name"]}
        />
        <label className="mb-4 flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={isParticular}
            onChange={(e) => setIsParticular(e.target.checked)}
          />
          É atendimento particular (paciente paga direto, sem operadora)
        </label>
        {!isParticular && (
          <>
            <TextField
              label="Registro ANS (opcional)"
              value={ansRegistry}
              onChange={(e) => setAnsRegistry(e.target.value)}
              error={fieldErrors["ans_registry"]}
            />
            <TextField
              label="Prazo para recorrer de glosa, em dias (opcional)"
              type="number"
              min="1"
              placeholder="Ex.: 30 — está no contrato com o convênio"
              value={appealDeadlineDays}
              onChange={(e) => setAppealDeadlineDays(e.target.value)}
              error={fieldErrors["default_appeal_deadline_days"]}
            />
          </>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={resetAndClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Salvando..." : "Cadastrar convênio"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function CreateCompanyModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
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
      default_appeal_deadline_days: appealDeadlineDays
        ? parseInt(appealDeadlineDays, 10)
        : null,
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
          Não é uma regra da ANS — é o prazo que consta no CONTRATO com esta
          operadora. Deixe em branco para usar o padrão geral até confirmar o
          número exato.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={resetAndClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Salvando..." : "Cadastrar operadora"}
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
  const [planType, setPlanType] = useState<InsurancePlanType>("convenio");
  const [companyId, setCompanyId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [ansRegistry, setAnsRegistry] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: (payload: InsurancePlanCreateRequest) =>
      apiClient.post<InsurancePlan>(
        "/api/v1/insurance-companies/plans",
        payload,
      ),
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
    setPlanType("convenio");
    setCompanyId("");
    setDisplayName("");
    setAnsRegistry("");
    setFieldErrors({});
    onClose();
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    if (planType === "convenio" && !companyId) {
      setFieldErrors({ insurance_company_id: "Selecione uma operadora." });
      return;
    }
    mutation.mutate({
      insurance_company_id: planType === "convenio" ? companyId : null,
      display_name: displayName,
      ans_registry: planType === "convenio" ? ansRegistry || null : null,
      plan_type: planType,
    });
  }

  return (
    <Modal title="Novo plano" isOpen={isOpen} onClose={resetAndClose}>
      <form onSubmit={handleSubmit}>
        <SelectField
          label="Tipo"
          required
          value={planType}
          onChange={(e) => {
            setPlanType(e.target.value as InsurancePlanType);
            setCompanyId("");
          }}
        >
          <option value="convenio">Convênio</option>
          <option value="particular">Particular (sem operadora)</option>
        </SelectField>
        {planType === "convenio" && (
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
        )}
        <TextField
          label="Nome do plano"
          placeholder="Ex: Unimed Nacional Empresarial"
          required
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          error={fieldErrors["display_name"]}
        />
        {planType === "convenio" && (
          <TextField
            label="Registro ANS"
            value={ansRegistry}
            onChange={(e) => setAnsRegistry(e.target.value)}
            error={fieldErrors["ans_registry"]}
          />
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={resetAndClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Salvando..." : "Cadastrar plano"}
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
  const [items, setItems] = useState<ContractItemInput[]>([
    { tuss_code: "", procedure_name: "", agreed_price: 0 },
  ]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: (payload: ContractCreateRequest) =>
      apiClient.post<Contract>("/api/v1/contracts", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      showSuccess("Contrato cadastrado e tabela aprovada.");
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
    setConfirmDiscard(false);
    onClose();
  }

  // UX2-12: Esc ou clique fora não apagam o que foi digitado sem perguntar.
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const filledItems = items.filter((it) => it.tuss_code.trim() || (it.procedure_name ?? "").trim() || it.agreed_price > 0).length;
  const isDirty = Boolean(planId || validFrom || validUntil) || filledItems > 0;
  function requestClose() {
    if (mutation.isPending) return;
    if (isDirty) setConfirmDiscard(true);
    else resetAndClose();
  }

  function updateItem(index: number, patch: Partial<ContractItemInput>) {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, ...patch } : it)),
    );
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    if (!planId) {
      setFieldErrors({ insurance_plan_id: "Selecione o convênio." });
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
    <>
    <Modal
      title="Cadastro manual de contrato"
      isOpen={isOpen}
      onClose={requestClose}
      size="2xl"
    >
      <form onSubmit={handleSubmit}>
        <p className="mb-4 text-xs text-ink-faint">
          Para 1-2 procedimentos que você já sabe de cor. Se o contrato tem uma
          tabela de preços extensa em PDF, use “Enviar contrato (PDF)” em vez
          disso: o Insighta lê o documento para você.
        </p>
        <SelectField
          label="Convênio"
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
          <span className="text-xs font-medium text-ink-muted">
            Itens do contrato
          </span>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() =>
              setItems((prev) => [
                ...prev,
                { tuss_code: "", procedure_name: "", agreed_price: 0 },
              ])
            }
          >
            + Adicionar item
          </Button>
        </div>
        <div className="space-y-2">
          {items.map((item, index) => (
            <div
              key={index}
              className="grid grid-cols-[1fr_2fr_1fr_auto] gap-2"
            >
              <input
                className="rounded-sm border border-border bg-canvas-raised px-2 py-1.5 text-sm text-ink"
                placeholder="Código TUSS"
                value={item.tuss_code}
                onChange={(e) =>
                  updateItem(index, { tuss_code: e.target.value })
                }
                required
              />
              <input
                className="rounded-sm border border-border bg-canvas-raised px-2 py-1.5 text-sm text-ink"
                placeholder="Descrição do procedimento"
                value={item.procedure_name ?? ""}
                onChange={(e) =>
                  updateItem(index, { procedure_name: e.target.value })
                }
              />
              <MoneyInput
                className="rounded-sm border border-border bg-canvas-raised px-2 py-1.5 text-sm text-ink"
                placeholder="Valor (R$)"
                aria-label="Valor (R$)"
                value={item.agreed_price}
                onValueChange={(agreed_price) => updateItem(index, { agreed_price })}
                required
              />
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="text-denied"
                disabled={items.length === 1}
                onClick={() =>
                  setItems((prev) => prev.filter((_, i) => i !== index))
                }
                aria-label="Remover item"
              >
                ✕
              </Button>
            </div>
          ))}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={requestClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Salvando..." : "Salvar e aprovar tabela"}
          </Button>
        </div>
      </form>
    </Modal>
    <ConfirmDialog
      isOpen={confirmDiscard}
      title="Descartar o que foi digitado?"
      message={
        filledItems > 0
          ? `${filledItems === 1 ? "1 item digitado será descartado" : `${filledItems} itens digitados serão descartados`} junto com o convênio e a vigência.`
          : "O convênio e a vigência escolhidos serão descartados."
      }
      confirmLabel="Descartar"
      cancelLabel="Continuar editando"
      onConfirm={resetAndClose}
      onCancel={() => setConfirmDiscard(false)}
    />
    </>
  );
}

// ---------------------------------------------------------------------
// Upload de PDF (Parser Inteligente de Contratos)
// ---------------------------------------------------------------------

function UploadContractModal({
  isOpen,
  onClose,
  plans,
  onUploaded,
}: {
  isOpen: boolean;
  onClose: () => void;
  plans: InsurancePlan[];
  onUploaded: (contract: Contract) => void;
}) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [planId, setPlanId] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: (formData: FormData) =>
      apiClient.upload<Contract>("/api/v1/contracts/upload", formData),
    // UX2-13: a leitura começa sozinha e a conferência abre em seguida.
    onSuccess: (contract) => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      showSuccess("Contrato enviado. Lendo a tabela de preços para você conferir.");
      resetAndClose();
      onUploaded(contract);
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
      setFieldErrors({ insurance_plan_id: "Selecione o convênio." });
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
    <Modal
      title="Enviar contrato (PDF)"
      isOpen={isOpen}
      onClose={resetAndClose}
    >
      <form onSubmit={handleSubmit}>
        <p className="mb-4 text-xs text-ink-faint">
          O Insighta lê o PDF e monta a tabela de preços para você conferir
          antes de aprovar. Nada vale sem a sua revisão.
        </p>
        <SelectField
          label="Convênio"
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
          {fieldErrors["file"] && (
            <p className="mt-1 text-2xs text-denied">{fieldErrors["file"]}</p>
          )}
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
  planName,
  onClose,
}: {
  contract: Contract | null;
  planName: string | undefined;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [preview, setPreview] = useState<ExtractionPreview | null>(null);
  const [reviewItems, setReviewItems] = useState<ContractItemInput[]>([]);
  // Achado 1.7 da Auditoria Implacável: a extração via IA saiu do
  // caminho síncrono da requisição (ver DECISÃO em
  // app/sql/065_ai_generation_jobs.sql no backend) — o POST só devolve
  // um job_id, o resultado de verdade vem do polling abaixo.
  const [extractJobId, setExtractJobId] = useState<string | null>(null);

  const enqueueExtractMutation = useMutation({
    mutationFn: (contractId: string) =>
      apiClient.post<AiGenerationJobEnqueuedResponse>(
        `/api/v1/contracts/${contractId}/extract`,
      ),
    onSuccess: (data) => setExtractJobId(data.job_id),
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  const extractJobQuery = useQuery({
    queryKey: ["ai-jobs", extractJobId],
    queryFn: () =>
      apiClient.get<AiGenerationJob<ExtractionPreview>>(
        `/api/v1/ai-jobs/${extractJobId}`,
      ),
    enabled: extractJobId !== null,
    refetchInterval: (query) =>
      query.state.data?.status === "pending" ? 1000 : false,
  });

  useEffect(() => {
    const job = extractJobQuery.data;
    if (!job || job.status === "pending") return;
    if (job.status === "completed" && job.result) {
      setPreview(job.result);
      setReviewItems(
        job.result.items.map((i: ExtractedItem) => ({
          tuss_code: i.tuss_code,
          procedure_name: i.procedure_name,
          agreed_price: i.agreed_price,
        })),
      );
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
    } else if (job.status === "failed") {
      showError(job.error ?? "Não foi possível ler a tabela de preços do contrato.");
    }
    setExtractJobId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extractJobQuery.data]);

  const isExtracting =
    enqueueExtractMutation.isPending ||
    (extractJobId !== null && extractJobQuery.data?.status !== "failed");

  // UX2-13: abrir a conferência já começa a leitura (uma vez por contrato);
  // o botão "Ler tabela de preços" fica para tentar de novo após uma falha.
  const autoStartedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!contract || contract.status === "homologado" || !contract.pdf_s3_key) return;
    if (autoStartedFor.current === contract.id) return;
    autoStartedFor.current = contract.id;
    enqueueExtractMutation.mutate(contract.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contract?.id]);

  const homologateMutation = useMutation({
    mutationFn: ({
      contractId,
      payload,
    }: {
      contractId: string;
      payload: HomologateRequest;
    }) =>
      apiClient.post<Contract>(
        `/api/v1/contracts/${contractId}/homologate`,
        payload,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      showSuccess(
        "Tabela aprovada. Os preços já valem na comparação com o faturamento.",
      );
      handleClose();
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  function handleClose() {
    setPreview(null);
    setReviewItems([]);
    setExtractJobId(null);
    autoStartedFor.current = null;
    onClose();
  }

  function updateItem(index: number, patch: Partial<ContractItemInput>) {
    setReviewItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, ...patch } : it)),
    );
  }

  if (!contract) return null;

  const warningByCode = new Map(
    (preview?.items ?? []).map((i) => [i.tuss_code, i.warning]),
  );
  const pageByCode = new Map(
    (preview?.items ?? []).map((i) => [i.tuss_code, i.source_page ?? null]),
  );

  return (
    <Modal
      title={
        planName
          ? `Conferir tabela de preços — ${planName}`
          : "Conferir tabela de preços"
      }
      isOpen={Boolean(contract)}
      onClose={handleClose}
      size="2xl"
    >
      {!preview && (
        <div className="py-6 text-center">
          <p className="mb-4 text-sm text-ink-muted">
            {isExtracting
              ? "Lendo o PDF e montando a tabela de preços. Leva alguns segundos."
              : "A tabela de preços deste contrato ainda não foi lida."}
          </p>
          <Button
            onClick={() => enqueueExtractMutation.mutate(contract.id)}
            disabled={isExtracting}
          >
            {isExtracting ? "Lendo o contrato..." : "Ler tabela de preços"}
          </Button>
          {enqueueExtractMutation.isError && (
            <p className="mt-3 text-xs text-denied">
              {getApiErrorMessage(enqueueExtractMutation.error)}
            </p>
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
            {preview.pages_total
              ? `${extractionPagesNote(preview.pages_total, preview.pages_sent_to_ai)} `
              : ""}
            Confira e corrija os itens abaixo. Só depois de “Aprovar tabela” os
            preços passam a valer na comparação com o faturamento.
          </p>
          <div className="max-h-80 space-y-3 overflow-y-auto">
            {reviewItems.map((item, index) => {
              const warning = warningByCode.get(item.tuss_code);
              const page = pageByCode.get(item.tuss_code);
              return (
                <div
                  key={index}
                  className={cn(
                    "rounded-md border px-3 py-2.5",
                    warning
                      ? "border-pending/35 bg-pending/[6%]"
                      : "border-border-subtle",
                  )}
                >
                  <div className="grid grid-cols-[110px_1fr_120px_32px] items-center gap-2.5">
                    <input
                      className="rounded-sm border border-transparent bg-transparent px-1 py-1 font-mono text-xs text-ink transition-colors focus:border-border-default focus:bg-canvas-raised focus:outline-none"
                      value={item.tuss_code}
                      onChange={(e) =>
                        updateItem(index, { tuss_code: e.target.value })
                      }
                    />
                    <input
                      className="rounded-sm border border-transparent bg-transparent px-1 py-1 text-sm text-ink transition-colors focus:border-border-default focus:bg-canvas-raised focus:outline-none"
                      value={item.procedure_name ?? ""}
                      onChange={(e) =>
                        updateItem(index, { procedure_name: e.target.value })
                      }
                    />
                    <MoneyInput
                      className="tabular rounded-sm border border-transparent bg-transparent px-1 py-1 text-right font-mono text-sm text-ink transition-colors focus:border-border-default focus:bg-canvas-raised focus:outline-none"
                      aria-label="Valor acordado (R$)"
                      value={item.agreed_price}
                      onValueChange={(agreed_price) => updateItem(index, { agreed_price })}
                    />
                    <button
                      type="button"
                      className="flex h-8 w-8 items-center justify-center text-denied transition-colors hover:text-denied/70"
                      onClick={() =>
                        setReviewItems((prev) =>
                          prev.filter((_, i) => i !== index),
                        )
                      }
                      aria-label="Remover item"
                    >
                      <X size={13} strokeWidth={2} />
                    </button>
                  </div>
                  {page && (
                    <p className="mt-1 text-2xs text-ink-faint">
                      Página {page} do PDF
                    </p>
                  )}
                  {warning && (
                    <p className="mt-1 text-2xs text-pending">⚠ {warning}</p>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-3">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() =>
                setReviewItems((prev) => [
                  ...prev,
                  { tuss_code: "", procedure_name: "", agreed_price: 0 },
                ])
              }
            >
              + Adicionar item
            </Button>
          </div>

          <div className="mt-5 flex justify-end gap-2 border-t border-border-hairline pt-4">
            <Button type="button" variant="secondary" onClick={handleClose}>
              Cancelar
            </Button>
            <Button
              onClick={() =>
                homologateMutation.mutate({
                  contractId: contract.id,
                  payload: { items: reviewItems },
                })
              }
              disabled={
                homologateMutation.isPending || reviewItems.length === 0
              }
            >
              {homologateMutation.isPending ? "Aprovando..." : "Aprovar tabela"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/** "12 páginas lidas; 3 precisaram de IA." — leitura em camadas (estudo de IA de baixo custo). */
export function extractionPagesNote(
  total: number,
  sentToAi: number | null | undefined,
): string {
  const read = `${total} ${total === 1 ? "página lida" : "páginas lidas"}`;
  if (sentToAi === null || sentToAi === undefined) return `${read}.`;
  if (sentToAi === 0) return `${read}, sem precisar de IA.`;
  return `${read}; ${sentToAi} ${sentToAi === 1 ? "precisou" : "precisaram"} de IA.`;
}

// ---------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------

const PAYER_TABS_GROUP = "convenios";
type PayerTabId = "visao-geral" | "glosas" | "prazos" | "contratos";
const PAYER_TAB_IDS: PayerTabId[] = [
  "visao-geral",
  "glosas",
  "prazos",
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
 * simulação de prazo), "Glosas", "Prazos de pagamento" e "Contratos e
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
          { id: "prazos", label: "Prazos de pagamento" },
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
          <PaymentLagPanel dateFrom={dateFrom} dateTo={dateTo} />
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
