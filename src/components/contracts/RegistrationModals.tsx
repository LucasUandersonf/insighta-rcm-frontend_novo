// Cadastro de convênio, operadora e plano (S4: saiu de ContractsPage.tsx).
import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TextField, SelectField } from "@/components/ui/FormField";
import { apiClient, ApiError } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { useToast } from "@/context/ToastContext";
import type { InsuranceCompany, InsuranceCompanyCreateRequest, InsurancePlan, InsurancePlanCreateRequest, InsurancePlanType } from "@/lib/types";
import { useDirtyOnEdit } from "@/lib/unsavedChanges";

// UX-07: para a clínica, "Unimed" é um convênio — um formulário só. A
// operadora é criada junto (particular não tem); operadora e plano
// separados ficam em "Operadoras e planos (avançado)".
export function CreateConvenioModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const unsaved = useDirtyOnEdit("o cadastro do convênio", isOpen);
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
      <form onChange={unsaved.onChange} onSubmitCapture={unsaved.onSubmit} onSubmit={handleSubmit}>
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

export function CreateCompanyModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const unsaved = useDirtyOnEdit("o cadastro da operadora", isOpen);
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
      <form onChange={unsaved.onChange} onSubmitCapture={unsaved.onSubmit} onSubmit={handleSubmit}>
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

export function CreatePlanModal({
  isOpen,
  onClose,
  companies,
}: {
  isOpen: boolean;
  onClose: () => void;
  companies: InsuranceCompany[];
}) {
  const unsaved = useDirtyOnEdit("o cadastro do plano", isOpen);
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
      <form onChange={unsaved.onChange} onSubmitCapture={unsaved.onSubmit} onSubmit={handleSubmit}>
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
