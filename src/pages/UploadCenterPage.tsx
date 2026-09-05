import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UploadCloud, Wand2 } from "lucide-react";
import { Panel, EmptyState, LoadingState, ErrorState } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Dropzone } from "@/components/ui/Dropzone";
import { Modal } from "@/components/ui/Modal";
import { SelectField, TextField } from "@/components/ui/FormField";
import { Pagination } from "@/components/ui/Pagination";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { useToast } from "@/context/ToastContext";
import type {
  ColumnMappingPreview,
  Contract,
  IngestionFileEntry,
  InsurancePlan,
  PaginatedResponse,
  UploadIngestionFileResponse,
} from "@/lib/types";

// Rótulo em português por campo canônico — espelha
// app/services/column_mapping_service.py::CANONICAL_FIELD_LABELS no
// backend (mantidos manualmente em sincronia, mesmo critério do resto
// deste arquivo de tipos/telas).
const CANONICAL_FIELD_LABELS: Record<string, string> = {
  patient_cpf: "CPF do paciente",
  patient_name: "Nome do paciente",
  professional_name: "Nome do profissional",
  professional_registry: "Registro do profissional",
  insurance_plan_raw_name: "Convênio",
  procedure_code: "Código do procedimento",
  cid_code: "CID",
  charged_value: "Valor cobrado",
  service_date: "Data do atendimento",
  local_name: "Local de atendimento",
  tipo_paciente: "Tipo de paciente",
  guia_tipo: "Tipo de guia",
  guia_numero: "Número da guia",
  guia_senha: "Senha da guia",
};

// Central de Upload — o caminho que faltava no produto para o cliente
// colocar dado real no sistema pela própria UI, sem depender de acesso a
// infraestrutura (S3/SFTP). Duas frentes, cada uma com seu próprio
// endpoint e formato: lotes operacionais (CSV/XML/JSON — billing/agenda/
// repasse, via app/api/v1/endpoints/ingestion.py) e contratos de
// convênio (PDF — via app/api/v1/endpoints/contracts.py, o mesmo Parser
// Inteligente já usado em Convênios & Contratos).

type Tab = "lotes" | "contratos";

const HISTORY_PAGE_SIZE = 15;

const STATUS_LABELS: Record<string, string> = {
  processing: "Processando",
  processed: "Processado",
  failed: "Falhou",
};

const STATUS_TONE: Record<string, BadgeTone> = {
  processing: "pending",
  processed: "revenue",
  failed: "denied",
};

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium" }).format(new Date(iso));
}

/**
 * Mapeador Automático de Coluna (ver DECISÃO em
 * app/sql/021_ingestion_column_aliases.sql) — escopo: só CSV do template
 * de Faturamento. Fluxo: abre já disparando o preview (só lê o
 * cabeçalho, nunca processa linha); o usuário revisa/corrige a sugestão
 * pros campos obrigatórios ainda não reconhecidos e confirma — depois
 * disso, todo upload FUTURO deste tenant aplica o mapeamento sozinho.
 */
function ColumnMappingModal({ file, isOpen, onClose }: { file: File | null; isOpen: boolean; onClose: () => void }) {
  const { showSuccess, showError } = useToast();
  const [assignments, setAssignments] = useState<Record<string, string>>({});

  const previewQuery = useQuery({
    queryKey: ["ingestion-column-mapping-preview", file?.name, file?.size],
    queryFn: async () => {
      const formData = new FormData();
      formData.append("file", file as File);
      formData.append("data_type", "faturamento");
      const result = await apiClient.upload<ColumnMappingPreview>("/api/v1/ingestion/preview-headers", formData);
      // Pré-preenche com a sugestão automática — invertida (campo -> cabeçalho)
      // pra alimentar um select por campo obrigatório.
      const initial: Record<string, string> = {};
      for (const [header, field] of Object.entries(result.suggested_mapping)) initial[field] = header;
      setAssignments(initial);
      return result;
    },
    enabled: isOpen && file !== null,
  });

  const saveMutation = useMutation({
    mutationFn: (mapping: Record<string, string>) =>
      apiClient.post("/api/v1/ingestion/column-aliases", { data_type: "faturamento", mapping }),
    onSuccess: () => {
      showSuccess("Mapeamento salvo — todo upload futuro deste template já aplica sozinho. Pode enviar o arquivo agora.");
      onClose();
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  function handleConfirm() {
    // Inverte de volta: {campo: cabeçalho} -> {cabeçalho: campo}, formato
    // que POST /ingestion/column-aliases espera.
    const mapping: Record<string, string> = {};
    for (const [field, header] of Object.entries(assignments)) {
      if (header) mapping[header] = field;
    }
    if (Object.keys(mapping).length === 0) {
      showError("Associe pelo menos um cabeçalho a um campo antes de confirmar.");
      return;
    }
    saveMutation.mutate(mapping);
  }

  const preview = previewQuery.data;
  // Campos que precisam de uma decisão do usuário: os que o backend não
  // resolveu sozinho (nem padrão, nem sugestão automática confiante o
  // bastante) — sempre incluindo os já sugeridos, pra o usuário poder
  // corrigir uma sugestão errada antes de confirmar.
  const fieldsToReview = preview
    ? Array.from(new Set([...preview.unresolved_required_fields, ...Object.values(preview.suggested_mapping)]))
    : [];

  return (
    <Modal title="Mapear colunas do arquivo" isOpen={isOpen} onClose={onClose}>
      {previewQuery.isLoading && <p className="text-xs text-ink-faint">Lendo cabeçalho do arquivo...</p>}
      {previewQuery.error && <p className="text-xs text-denied">{getApiErrorMessage(previewQuery.error)}</p>}
      {preview && (
        <div>
          <p className="mb-4 text-xs leading-relaxed text-ink-faint">
            Seu arquivo usa cabeçalhos diferentes do nosso padrão. Associe cada campo obrigatório à coluna correspondente do
            seu arquivo — a gente já tentou adivinhar, é só conferir. Depois de confirmar, todo próximo upload já reconhece
            sozinho, sem precisar repetir isso.
          </p>
          {fieldsToReview.length === 0 && (
            <p className="text-xs text-ink-muted">Este arquivo já usa o cabeçalho padrão — nenhum mapeamento necessário.</p>
          )}
          {fieldsToReview.map((field) => (
            <SelectField
              key={field}
              label={CANONICAL_FIELD_LABELS[field] ?? field}
              value={assignments[field] ?? ""}
              onChange={(e) => setAssignments((a) => ({ ...a, [field]: e.target.value }))}
            >
              <option value="">Não mapear</option>
              {preview.raw_headers.map((header) => (
                <option key={header} value={header}>
                  {header}
                </option>
              ))}
            </SelectField>
          ))}
          {preview.unresolved_required_fields.length > 0 && (
            <p className="-mt-2 mb-4 text-2xs text-pending">
              Sem mapear todos os campos obrigatórios acima, o arquivo continuará rejeitando as linhas.
            </p>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleConfirm} disabled={saveMutation.isPending || fieldsToReview.length === 0}>
              {saveMutation.isPending ? "Salvando..." : "Confirmar mapeamento"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

const DATA_TYPE_LABELS: Record<string, string> = {
  faturamento: "Faturamento",
  agenda: "Agenda",
};

function BatchUploadTab() {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [dataType, setDataType] = useState<"faturamento" | "agenda">("faturamento");
  const [offset, setOffset] = useState(0);
  const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);

  const mutation = useMutation({
    mutationFn: (f: File) => {
      const formData = new FormData();
      formData.append("file", f);
      formData.append("data_type", dataType);
      return apiClient.upload<UploadIngestionFileResponse>("/api/v1/ingestion/upload", formData);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["ingestion-files"] });
      setFile(null);
      if (result.already_processed) {
        showSuccess(result.message ?? "Este arquivo já havia sido processado antes — nada foi duplicado.");
      } else if (result.error_row_count > 0) {
        showSuccess(
          `Arquivo processado: ${result.row_count} linha(s) importada(s), ${result.error_row_count} rejeitada(s) — veja a tela de Setup para resolver.`
        );
      } else {
        showSuccess(`Arquivo processado com sucesso: ${result.row_count} linha(s) importada(s).`);
      }
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  const { data: history, isLoading, error, refetch } = useQuery({
    queryKey: ["ingestion-files", offset],
    queryFn: () =>
      apiClient.get<PaginatedResponse<IngestionFileEntry>>(
        `/api/v1/ingestion/files?limit=${HISTORY_PAGE_SIZE}&offset=${offset}`
      ),
  });

  return (
    <div className="space-y-4">
      <Panel
        title="Upload de lotes operacionais"
        subtitle="CSV, XML ou JSON — faturamento ou agenda do seu ERP. Processado na hora: você vê o resultado nesta mesma tela."
      >
        <div className="p-4">
          <SelectField
            label="Template"
            value={dataType}
            onChange={(e) => setDataType(e.target.value as "faturamento" | "agenda")}
            className="mb-4 max-w-xs"
          >
            <option value="faturamento">Faturamento</option>
            <option value="agenda">Agenda</option>
          </SelectField>
          <Dropzone
            accept={[".csv", ".xml", ".json"]}
            hint="CSV, XML ou JSON — até 20MB"
            file={file}
            onFileSelected={setFile}
            isUploading={mutation.isPending}
          />
          <div className="mt-4 flex justify-end gap-2">
            {dataType === "faturamento" && file?.name.toLowerCase().endsWith(".csv") && (
              <Button type="button" variant="secondary" onClick={() => setIsMappingModalOpen(true)} className="flex items-center gap-1.5">
                <Wand2 size={14} />
                Mapear colunas
              </Button>
            )}
            <Button disabled={!file || mutation.isPending} onClick={() => file && mutation.mutate(file)}>
              {mutation.isPending ? "Enviando..." : "Enviar arquivo"}
            </Button>
          </div>
          <p className="mt-2 text-2xs text-ink-faint">
            Cabeçalho do arquivo diferente do nosso padrão? Use "Mapear colunas" antes de enviar — evita que o arquivo
            inteiro seja rejeitado por um nome de coluna diferente.
          </p>
        </div>
      </Panel>

      <ColumnMappingModal file={file} isOpen={isMappingModalOpen} onClose={() => setIsMappingModalOpen(false)} />

      <Panel title="Histórico de importações" subtitle="Últimos arquivos enviados por este tenant, mais recente primeiro">
        {isLoading && <LoadingState variant="table" rows={4} />}
        {error && <ErrorState message={getApiErrorMessage(error)} onRetry={() => refetch()} />}
        {!isLoading && !error && (history?.items ?? []).length === 0 && (
          <EmptyState icon={<UploadCloud size={17} strokeWidth={1.5} />} message="Nenhum arquivo enviado ainda — o primeiro upload aparece aqui assim que for processado." />
        )}
          {!isLoading && (history?.items ?? []).length > 0 && (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border-hairline text-2xs uppercase tracking-wide text-ink-faint">
                  <th className="px-4 py-2.5 font-medium">Arquivo</th>
                  <th className="px-4 py-2.5 font-medium">Template</th>
                  <th className="px-4 py-2.5 font-medium">Formato</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Linhas importadas</th>
                  <th className="px-4 py-2.5 font-medium">Linhas rejeitadas</th>
                  <th className="px-4 py-2.5 font-medium">Recebido em</th>
                </tr>
              </thead>
              <tbody>
                {(history?.items ?? []).map((f) => (
                  <tr key={f.id} className="border-b border-border-hairline last:border-0 transition-colors hover:bg-canvas-raised/60">
                    <td className="px-4 py-2.5 text-ink">{f.original_filename ?? "—"}</td>
                    <td className="px-4 py-2.5 text-ink-muted">{DATA_TYPE_LABELS[f.data_type] ?? f.data_type}</td>
                    <td className="px-4 py-2.5 text-ink-muted uppercase">{f.file_format}</td>
                    <td className="px-4 py-2.5">
                      <Badge tone={STATUS_TONE[f.status] ?? "neutral"}>{STATUS_LABELS[f.status] ?? f.status}</Badge>
                    </td>
                    <td className="tabular px-4 py-2.5 text-ink-muted">{f.row_count}</td>
                    <td className={`tabular px-4 py-2.5 ${f.error_row_count > 0 ? "text-denied" : "text-ink-muted"}`}>
                      {f.error_row_count > 0 ? f.error_row_count : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-ink-muted">{formatDateTime(f.received_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        {history && history.total > 0 && (
          <Pagination total={history.total} limit={HISTORY_PAGE_SIZE} offset={offset} onOffsetChange={setOffset} />
        )}
      </Panel>
    </div>
  );
}

function ContractUploadTab() {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [planId, setPlanId] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const { data: plans, isLoading: plansLoading } = useQuery({
    queryKey: ["insurance-plans"],
    queryFn: () => apiClient.get<InsurancePlan[]>("/api/v1/insurance-companies/plans"),
  });

  const mutation = useMutation({
    mutationFn: (formData: FormData) => apiClient.upload<Contract>("/api/v1/contracts/upload", formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      showSuccess("PDF enviado. Vá até Convênios & Contratos para extrair a tabela de preços com IA e homologar.");
      setPlanId("");
      setValidFrom("");
      setFile(null);
      setFieldErrors({});
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    const errors: Record<string, string> = {};
    if (!planId) errors.insurance_plan_id = "Selecione um plano.";
    if (!validFrom) errors.valid_from = "Informe a vigência inicial.";
    if (!file) errors.file = "Selecione o PDF do contrato.";
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    const formData = new FormData();
    formData.append("insurance_plan_id", planId);
    formData.append("valid_from", validFrom);
    formData.append("file", file as File);
    mutation.mutate(formData);
  }

  return (
    <Panel
      title="Upload de contratos de convênio"
      subtitle="PDF do contrato — a IA extrai a tabela de preços para você conferir antes de homologar. Nada é salvo direto sem revisão humana."
    >
      <form onSubmit={handleSubmit} className="p-4">
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="Plano"
            required
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
            error={fieldErrors["insurance_plan_id"]}
          >
            <option value="">{plansLoading ? "Carregando..." : "Selecione..."}</option>
            {(plans ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name}
              </option>
            ))}
          </SelectField>
          <TextField
            label="Vigência a partir de"
            type="date"
            required
            value={validFrom}
            onChange={(e) => setValidFrom(e.target.value)}
            error={fieldErrors["valid_from"]}
          />
        </div>

        <div className="mb-1.5 mt-1 text-xs font-medium text-ink-muted">
          PDF do contrato
          <span className="text-denied"> *</span>
        </div>
        <Dropzone accept={[".pdf"]} hint="PDF — até 20MB" file={file} onFileSelected={setFile} isUploading={mutation.isPending} />
        {fieldErrors["file"] && <p className="mt-1 text-2xs text-denied">{fieldErrors["file"]}</p>}

        <div className="mt-5 flex justify-end">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Enviando..." : "Enviar contrato"}
          </Button>
        </div>
      </form>
    </Panel>
  );
}

const TABS_GROUP = "central-upload";

export function UploadCenterPage() {
  const [tab, setTab] = useState<Tab>("lotes");

  return (
    <div className="space-y-6">
      <PageHeader
        icon={UploadCloud}
        title="Central de upload"
        subtitle="Onde o dado real entra no sistema — lotes operacionais do seu ERP e contratos de convênio, direto pela UI."
      />

      <Tabs
        groupId={TABS_GROUP}
        active={tab}
        onChange={(id) => setTab(id as Tab)}
        items={[
          { id: "lotes", label: "Lotes Operacionais" },
          { id: "contratos", label: "Contratos de Convênio" },
        ]}
      />

      {tab === "lotes" ? <BatchUploadTab /> : <ContractUploadTab />}
    </div>
  );
}
