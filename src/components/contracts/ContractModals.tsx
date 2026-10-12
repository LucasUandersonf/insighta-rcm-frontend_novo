// Contrato manual, envio de PDF e revisão da extração (S4: saiu de ContractsPage.tsx).
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { TextField, SelectField } from "@/components/ui/FormField";
import { cn } from "@/lib/cn";
import { apiClient, ApiError } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { useToast } from "@/context/ToastContext";
import type { AiGenerationJob, AiGenerationJobEnqueuedResponse, Contract, ContractCreateRequest, ContractItemInput, ExtractedItem, ExtractionPreview, HomologateRequest, InsurancePlan } from "@/lib/types";
import { MoneyInput } from "@/components/ui/MoneyField";
import { useDirtyOnEdit } from "@/lib/unsavedChanges";

export function ManualContractModal({
  isOpen,
  onClose,
  plans,
}: {
  isOpen: boolean;
  onClose: () => void;
  plans: InsurancePlan[];
}) {
  const unsaved = useDirtyOnEdit("o contrato", isOpen);
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
      <form onChange={unsaved.onChange} onSubmitCapture={unsaved.onSubmit} onSubmit={handleSubmit}>
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

export function UploadContractModal({
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
  const unsaved = useDirtyOnEdit("o envio do contrato", isOpen);
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
      <form onChange={unsaved.onChange} onSubmitCapture={unsaved.onSubmit} onSubmit={handleSubmit}>
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

export function ReviewContractModal({
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
                      ? "border-pending/35 bg-pending/6"
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
