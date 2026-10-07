import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileSpreadsheet, UploadCloud, Wand2 } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { Panel, EmptyState, LoadingState, ErrorState } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Dropzone } from "@/components/ui/Dropzone";
import { Modal } from "@/components/ui/Modal";
import { SelectField, TextField } from "@/components/ui/FormField";
import { Pagination } from "@/components/ui/Pagination";
import { PageHeader } from "@/components/ui/PageHeader";
import { ImportDataNav } from "@/components/layout/ImportDataNav";
import { Tabs, TabPanel } from "@/components/ui/Tabs";
import { apiClient } from "@/lib/api-client";
import {
  ACTIVE_STATES,
  LARGE_FILE_UNAVAILABLE_MESSAGE,
  SYNC_UPLOAD_MAX_BYTES,
  processingPercent,
  startDirectUpload,
  type DirectUploadStatus,
} from "@/lib/directUpload";
import { DIRECT_UPLOADS_QUERY_KEY, useDirectUploads } from "@/lib/useDirectUploads";
import { getApiErrorMessage } from "@/lib/query-client";
import { useToast } from "@/context/ToastContext";
import { useAuth } from "@/context/AuthContext";
import { UnknownPlanActions } from "@/components/ingestion/UnknownPlanActions";
import { OUTCOME_LABEL, OUTCOME_TONE, formatCount, importOutcome, outcomeSentence, plural } from "@/lib/importOutcome";
import type {
  IngestionTemplate,
  IngestionValidationReport,
  ColumnAlias,
  ColumnMappingPreview,
  Contract,
  IngestionFileEntry,
  IngestionUndoResponse,
  InsurancePlan,
  PaginatedResponse,
  UploadIngestionFileResponse,
} from "@/lib/types";
import { word } from "@/lib/plural";

// Rótulo em português por campo canônico — espelha
// app/services/column_mapping_service.py::CANONICAL_FIELD_LABELS no
// backend (mantidos manualmente em sincronia, mesmo critério do resto
// deste arquivo de tipos/telas).
const CANONICAL_FIELD_LABELS: Record<string, string> = {
  source_row_id: "ID da transação",
  source_appointment_id: "ID do atendimento",
  service_date: "Data do atendimento",
  service_time: "Hora do atendimento",
  competencia: "Competência",
  billing_period: "Período de faturamento",
  local_name: "Nome da unidade",
  local_type: "Tipo da unidade",
  local_external_id: "ID da unidade",
  patient_external_hash: "Hash do paciente",
  patient_document_masked: "Documento mascarado",
  age_at_visit: "Idade do paciente",
  age_bracket: "Faixa etária do paciente",
  patient_sex: "Sexo do paciente",
  patient_municipio: "Município do paciente",
  patient_estado: "Estado do paciente",
  tipo_pessoa: "Tipo de pessoa",
  insurance_plan_raw_name: "Convênio",
  tipo_convenio: "Tipo de convênio",
  source_insurance_plan_code: "ID do convênio (sistema de origem)",
  source_plan_code: "ID do plano (sistema de origem)",
  plan_tier: "Nome do plano",
  accommodation_type: "Tipo de acomodação",
  service_category: "Tipo de atendimento",
  source_service_type_code: "ID do tipo de atendimento (sistema de origem)",
  carater_atendimento: "Caráter do atendimento",
  cid_code: "CID principal",
  cid_principal_description: "Descrição do CID principal",
  cid_secundario: "CID secundário",
  cid_secundario_description: "Descrição do CID secundário",
  professional_name: "Nome do profissional executante",
  professional_registry: "Conselho do profissional executante",
  professional_specialty: "Especialidade do profissional",
  professional_external_id: "ID do profissional executante (sistema de origem)",
  requesting_professional_name: "Nome do profissional solicitante",
  requesting_professional_external_id: "ID do profissional solicitante (sistema de origem)",
  procedure_code: "Código do procedimento",
  procedure_name: "Nome do procedimento",
  procedure_group: "Grupo do procedimento",
  source_procedure_code: "ID do procedimento (sistema de origem)",
  quantidade: "Quantidade executada",
  lote_external_id: "ID do lote",
  lote_generated_at: "Data de geração do lote",
  lote_status: "Status do lote",
  charged_value: "Valor cobrado",
  unit_value: "Valor unitário",
  discount_percentage: "Percentual de desconto",
  discount_value: "Valor de desconto",
  motivo_glosa: "Motivo da glosa",
  received_value: "Valor recebido",
  payment_method: "Forma de pagamento",
  payment_bank: "Banco de recebimento",
  due_date: "Data de vencimento",
  settlement_date: "Data de recebimento",
  notes: "Observações",
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
  failed: "Falhou",
};

const STATUS_TONE: Record<string, BadgeTone> = {
  processing: "pending",
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
function ColumnMappingModal({
  file,
  dataType,
  template,
  isOpen,
  onClose,
}: {
  file: File | null;
  dataType: string;
  template: IngestionTemplate | undefined;
  isOpen: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [assignments, setAssignments] = useState<Record<string, string>>({});

  const previewQuery = useQuery({
    queryKey: ["ingestion-column-mapping-preview", dataType, file?.name, file?.size],
    queryFn: async () => {
      const formData = new FormData();
      formData.append("file", file as File);
      formData.append("data_type", dataType);
      const result = await apiClient.upload<ColumnMappingPreview>("/api/v1/ingestion/preview-headers", formData);
      // Pré-preenche com o mapeamento salvo (UX-10: antes ficava invisível) e
      // a sugestão automática — invertidos (campo -> cabeçalho), um select por campo.
      const initial: Record<string, string> = {};
      for (const [header, field] of Object.entries(result.saved_mapping ?? {})) initial[field] = header;
      for (const [header, field] of Object.entries(result.suggested_mapping)) initial[field] = header;
      setAssignments(initial);
      setAcceptWarnings(false);
      return result;
    },
    enabled: isOpen && file !== null,
  });
  const [acceptWarnings, setAcceptWarnings] = useState(false);
  const aliasesQuery = useQuery({
    queryKey: ["ingestion-column-aliases", dataType],
    queryFn: () => apiClient.get<ColumnAlias[]>(`/api/v1/ingestion/column-aliases?data_type=${encodeURIComponent(dataType)}`),
    enabled: isOpen,
  });

  const saveMutation = useMutation({
    mutationFn: async (mapping: Record<string, string>) => {
      await apiClient.post("/api/v1/ingestion/column-aliases", { data_type: dataType, mapping });
      // UX-10: trocar a coluna de um campo apaga o mapeamento antigo dele
      // (antes, o errado continuava valendo junto com o novo).
      const chosenFields = new Set(Object.values(mapping));
      const stale = (Array.isArray(aliasesQuery.data) ? aliasesQuery.data : []).filter(
        (alias) => (chosenFields.has(alias.canonical_field) && mapping[alias.source_header] !== alias.canonical_field) || removedHeaders.has(alias.source_header)
      );
      for (const alias of stale) await apiClient.delete(`/api/v1/ingestion/column-aliases/${alias.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ingestion-column-aliases", dataType] });
      queryClient.invalidateQueries({ queryKey: ["ingestion-column-mapping-preview"] });
      showSuccess("Mapeamento salvo. Os próximos arquivos deste tipo já usam essas colunas — pode enviar agora.");
      onClose();
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  const preview = previewQuery.data;
  const savedFields = new Set(Object.values(preview?.saved_mapping ?? {}));
  // Campos para conferir: os que faltam, os sugeridos agora e os já salvos.
  const fieldsToReview = preview
    ? Array.from(new Set([...preview.unresolved_required_fields, ...Object.values(preview.suggested_mapping), ...savedFields]))
    : [];
  const removedHeaders = new Set(
    Object.entries(preview?.saved_mapping ?? {})
      .filter(([header, field]) => assignments[field] !== header)
      .map(([header]) => header)
  );
  // UX-09: valores da coluna escolhida que não combinam com o campo.
  const warningFor = (field: string): string | null => {
    const header = assignments[field];
    if (!header || !preview) return null;
    const known = preview.warnings?.[header];
    if (known && (preview.suggested_mapping[header] === field || preview.saved_mapping?.[header] === field)) return known;
    return checkSamples(field, preview.samples?.[header] ?? []);
  };
  const warnings = fieldsToReview.map(warningFor).filter(Boolean);

  function handleConfirm() {
    // Inverte de volta: {campo: cabeçalho} -> {cabeçalho: campo}, formato
    // que POST /ingestion/column-aliases espera.
    const mapping: Record<string, string> = {};
    for (const [field, header] of Object.entries(assignments)) {
      if (header) mapping[header] = field;
    }
    if (Object.keys(mapping).length === 0) {
      showError("Escolha a coluna de pelo menos um campo antes de salvar.");
      return;
    }
    saveMutation.mutate(mapping);
  }

  return (
    <Modal title="Mapear colunas do arquivo" isOpen={isOpen} onClose={onClose}>
      {previewQuery.isLoading && <p className="text-xs text-ink-faint">Lendo o cabeçalho do arquivo…</p>}
      {previewQuery.error && <p className="text-xs text-denied">{getApiErrorMessage(previewQuery.error)}</p>}
      {preview && (
        <div>
          <p className="mb-4 text-xs leading-relaxed text-ink-muted">
            Diga qual coluna do seu arquivo corresponde a cada campo. Sugerimos as colunas abaixo — confira os exemplos de cada uma
            antes de salvar. Depois de salvar, os próximos arquivos deste tipo já usam essas colunas.
          </p>
          {fieldsToReview.length === 0 && (
            <p className="text-xs text-ink-muted">Este arquivo já usa os nomes de coluna do modelo — não precisa mapear nada.</p>
          )}
          {fieldsToReview.map((field) => {
            const header = assignments[field];
            const examples = header ? preview.samples?.[header] ?? [] : [];
            const warning = warningFor(field);
            return (
              <div key={field} className="mb-3">
                <SelectField
                  label={
                    (CANONICAL_FIELD_LABELS[field] ?? template?.columns.find((c) => c.header === field)?.label ?? field) +
                    (savedFields.has(field) && preview.saved_mapping?.[header ?? ""] === field ? " (mapeamento salvo)" : "")
                  }
                  value={header ?? ""}
                  onChange={(e) => {
                    setAcceptWarnings(false);
                    setAssignments((a) => ({ ...a, [field]: e.target.value }));
                  }}
                  className="mb-1"
                >
                  <option value="">Não mapear</option>
                  {preview.raw_headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </SelectField>
                {examples.length > 0 && <p className="text-2xs text-ink-faint">Exemplos nesta coluna: {examples.join(" · ")}</p>}
                {warning && (
                  <p role="alert" className="mt-0.5 text-2xs text-denied">
                    {warning}
                  </p>
                )}
              </div>
            );
          })}
          {preview.unresolved_required_fields.some((f) => !assignments[f]) && (
            <p className="mb-3 text-2xs text-pending">Sem escolher a coluna de todos os campos obrigatórios, as linhas do arquivo continuam sendo recusadas.</p>
          )}
          {warnings.length > 0 && (
            <label className="mb-2 flex items-start gap-2 text-2xs text-ink">
              <input type="checkbox" className="mt-0.5" checked={acceptWarnings} onChange={(e) => setAcceptWarnings(e.target.checked)} />
              <span>Conferi: quero salvar mesmo com o aviso acima.</span>
            </label>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={saveMutation.isPending || fieldsToReview.length === 0 || (warnings.length > 0 && !acceptWarnings)}
            >
              {saveMutation.isPending ? "Salvando…" : "Salvar mapeamento"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/** UX-09: mesma regra do servidor para a coluna que a pessoa escolhe na hora. */
function checkSamples(field: string, values: string[]): string | null {
  const filled = values.filter((v) => v && v.trim());
  if (filled.length === 0) return null;
  const isDate = (v: string) => /^\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{4}-\d{1,2}-\d{1,2})/.test(v);
  const isNumber = (v: string) => /^\s*(R\$\s*)?-?[\d.]+(,\d+)?\s*$/.test(v);
  const key = field.toLowerCase();
  const sample = filled.slice(0, 3).join(", ");
  if (key.startsWith("status") && filled.every(isDate)) return `Esta coluna tem datas (${sample}), não a situação da consulta (agendado, atendido, faltou…).`;
  if (key.startsWith("status") && filled.every(isNumber)) return `Esta coluna tem números (${sample}), não a situação da consulta.`;
  if ((key.startsWith("data") || key.endsWith("_date")) && !filled.some(isDate)) return `Os valores desta coluna (${sample}) não parecem datas.`;
  if ((key.startsWith("valor") || key.startsWith("quantidade") || key.endsWith("_value")) && !filled.some(isNumber)) return `Os valores desta coluna (${sample}) não parecem números.`;
  return null;
}

/**
 * Auditoria V1, rodada 14 (B2): o mapeamento salvo valia em todo upload
 * futuro sem que a clínica pudesse ver ou esquecer — um cabeçalho associado
 * ao campo errado seguia levando valor para a coluna errada.
 */
function SavedMappings({ dataType, template }: { dataType: string; template: IngestionTemplate | undefined }) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const queryKey = ["ingestion-column-aliases", dataType];
  const aliases = useQuery({
    queryKey,
    queryFn: () => apiClient.get<ColumnAlias[]>(`/api/v1/ingestion/column-aliases?data_type=${encodeURIComponent(dataType)}`),
  });
  const forget = useMutation({
    mutationFn: (alias: ColumnAlias) => apiClient.delete(`/api/v1/ingestion/column-aliases/${alias.id}`),
    onSuccess: (_, alias) => {
      queryClient.invalidateQueries({ queryKey });
      showSuccess(`A coluna “${alias.source_header}” deixou de ser mapeada. Os próximos arquivos usam só os nomes do modelo.`);
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  const items = Array.isArray(aliases.data) ? aliases.data : [];
  if (items.length === 0) return null;
  const label = (field: string) => CANONICAL_FIELD_LABELS[field] ?? template?.columns.find((c) => c.header === field)?.label ?? field;

  return (
    <details className="mt-3 rounded-md border border-border-hairline bg-canvas-raised/40 px-3 py-2">
      <summary className="cursor-pointer text-xs text-ink-muted">Colunas que você já mapeou para este tipo ({items.length})</summary>
      <ul className="mt-2 divide-y divide-border-hairline">
        {items.map((alias) => (
          <li key={alias.id} className="flex items-center justify-between gap-3 py-1.5 text-xs">
            <span className="min-w-0 truncate text-ink">
              <span className="font-mono">{alias.source_header}</span>
              <span className="text-ink-faint"> → </span>
              {label(alias.canonical_field)}
            </span>
            <Button type="button" variant="ghost" size="xs" disabled={forget.isPending} onClick={() => forget.mutate(alias)}>
              Remover
            </Button>
          </li>
        ))}
      </ul>
    </details>
  );
}

async function saveBlob(path: string, filename: string): Promise<void> {
  const blob = await apiClient.getBlob(path);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Bloco 2 (autonomia) — antes do upload: o que o modelo pede (colunas
 * obrigatórias) e o botão para baixar o .xlsx pronto, com exemplo e aba
 * de instruções. A clínica nunca precisa perguntar "qual é o formato?".
 */
function TemplateGuide({ template }: { template: IngestionTemplate | undefined }) {
  const { showError } = useToast();
  if (!template) return null;
  const required = template.columns.filter((c) => c.required);
  return (
    <div className="mb-4 flex flex-col gap-2 rounded-md border border-border-hairline bg-canvas-raised/40 p-3 sm:flex-row sm:items-center">
      <div className="flex-1">
        <p className="text-xs text-ink-muted">{template.description}</p>
        <p className="mt-1 text-2xs text-ink-faint">
          Obrigatórias: {required.map((c) => c.label).join(", ")}.
        </p>
      </div>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="flex shrink-0 items-center gap-1.5"
        onClick={() =>
          saveBlob(`/api/v1/ingestion/templates/${template.data_type}.xlsx`, `modelo-${template.data_type}-insighta.xlsx`).catch((err) =>
            showError(getApiErrorMessage(err))
          )
        }
      >
        <FileSpreadsheet size={14} />
        Baixar modelo (.xlsx)
      </Button>
    </div>
  );
}

/** Bloco 2 — relatório de validação de um upload: o que entrou e o que ficou de fora, e por quê. */
export function UploadReportModal({ fileId, onClose }: { fileId: string | null; onClose: () => void }) {
  const { showError } = useToast();
  const { data, isLoading, error } = useQuery({
    queryKey: ["ingestion-report", fileId],
    queryFn: () => apiClient.get<IngestionValidationReport>(`/api/v1/ingestion/files/${fileId}/report`),
    enabled: fileId !== null,
  });
  return (
    <Modal title="Relatório da importação" isOpen={fileId !== null} onClose={onClose}>
      {isLoading && <LoadingState rows={3} />}
      {error && <ErrorState message={getApiErrorMessage(error)} />}
      {data && Array.isArray(data.reasons) && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink">
            {data.original_filename ?? "Arquivo"}:{" "}
            {data.accepted_rows === 0 && data.rejected_rows > 0 ? (
              <strong className="text-denied">nada foi importado</strong>
            ) : (
              <>
                <strong>{formatCount(data.accepted_rows)}</strong> de {formatCount(data.total_rows)}{" "}
                {data.total_rows === 1 ? "linha entrou" : "linhas entraram"}
              </>
            )}
            {data.rejected_rows > 0 ? ` — ${plural(data.rejected_rows, "linha ficou", "linhas ficaram")} de fora.` : " — nenhuma ficou de fora."}
          </p>
          {(data.created_plans?.length ?? 0) > 0 && (
            <p className="rounded-md border border-accent/30 bg-accent-bg px-3 py-2 text-xs text-ink">
              Este arquivo cadastrou {plural(data.created_plans!.length, "convênio novo", "convênios novos")}: {data.created_plans!.join(", ")}. Confira os
              nomes em <Link to="/convenios?tab=contratos" className="underline">Convênios</Link>.
            </p>
          )}
          {data.reasons.length > 0 && (
            <ul className="flex flex-col gap-2.5">
              {data.reasons.map((r) => (
                <li key={r.reason} className="rounded-md border border-pending/30 bg-pending/[6%] px-3 py-2">
                  <p className="text-xs text-ink">
                    {r.reason} <span className="text-ink-muted">({plural(r.count, "linha", "linhas")})</span>
                  </p>
                  <p className="mt-0.5 text-2xs text-ink-faint">
                    {r.rows.length < r.count ? "Por exemplo, " : ""}
                    {r.rows.length === 1 ? "linha" : "linhas"} {r.rows.join(", ")} da planilha.
                  </p>
                  {r.action === "unknown_insurance_plan" && r.raw_value && (
                    <div className="mt-2">
                      <UnknownPlanActions rawValue={r.raw_value} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          {data.rejected_rows > 0 && (
            <div className="flex justify-end">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="flex items-center gap-1.5"
                onClick={() =>
                  saveBlob(`/api/v1/ingestion/files/${data.ingestion_file_id}/report.csv`, `linhas-rejeitadas-${data.ingestion_file_id}.csv`).catch((err) =>
                    showError(getApiErrorMessage(err))
                  )
                }
              >
                <Download size={14} />
                Baixar linhas rejeitadas (CSV)
              </Button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

type DataType = "faturamento" | "agenda" | "atendimento" | "estoque" | "pep";
const DATA_TYPES: DataType[] = ["faturamento", "agenda", "atendimento", "estoque", "pep"];

const DATA_TYPE_LABELS: Record<string, string> = {
  faturamento: "Faturamento",
  agenda: "Agenda",
  atendimento: "Atendimento",
  estoque: "Estoque",
  pep: "PEP (Prontuário)",
};

// Formatos aceitos por template — Faturamento/Atendimento/Estoque/PEP
// aceitam CSV e JSON (mesmo dicionário de campos nos dois); Agenda é o
// único com XML também (ver DECISÃO em app/sql/019_agenda_ingestion.sql).
const ACCEPTED_FORMATS_BY_DATA_TYPE: Record<string, string[]> = {
  // .xlsx em todas as pernas: o backend converte a planilha para o CSV
  // do template (ver app/services/spreadsheet_conversion.py).
  faturamento: [".xlsx", ".csv", ".json"],
  agenda: [".xlsx", ".csv", ".xml", ".json"],
  atendimento: [".xlsx", ".csv", ".json"],
  estoque: [".xlsx", ".csv", ".json"],
  pep: [".xlsx", ".csv", ".json"],
};

function BatchUploadTab() {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [searchParams] = useSearchParams();
  const initialType = searchParams.get("tipo");
  const [dataType, setDataType] = useState<DataType>(
    DATA_TYPES.includes(initialType as DataType) ? (initialType as DataType) : "faturamento"
  );
  const [offset, setOffset] = useState(0);
  const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
  const [reportFileId, setReportFileId] = useState<string | null>(null);
  const [undoFile, setUndoFile] = useState<IngestionFileEntry | null>(null);
  const { user } = useAuth();
  const canUndo = !!user && ["owner", "admin"].includes(user.role);
  const { data: templates } = useQuery({
    queryKey: ["ingestion-templates"],
    queryFn: () => apiClient.get<IngestionTemplate[]>("/api/v1/ingestion/templates"),
    staleTime: 60 * 60 * 1000,
  });
  const template = Array.isArray(templates) ? templates.find((t) => t.data_type === dataType) : undefined;

  // UX-20/UX-21: o arquivo é conferido assim que é escolhido — vazio, formato
  // errado ou planilha de outro tipo aparecem ANTES de enviar.
  const [fileProblem, setFileProblem] = useState<string | null>(null);
  const [detected, setDetected] = useState<string | null>(null);
  const [savedMappingWarning, setSavedMappingWarning] = useState<string | null>(null);

  async function handleFileSelected(selected: File | null) {
    setFile(selected);
    setFileProblem(null);
    setDetected(null);
    setSavedMappingWarning(null);
    if (!selected) return;
    const ext = selected.name.toLowerCase().split(".").pop() ?? "";
    if (selected.size === 0) {
      setFileProblem("O arquivo está vazio. Exporte de novo do seu sistema e tente outra vez.");
      return;
    }
    if (ext === "pdf") {
      setFileProblem("PDF não é aceito aqui. Para planilhas, use .xlsx, .csv ou .json. Contrato em PDF? Envie na aba “Contratos de convênio (PDF)”.");
      return;
    }
    if (!ACCEPTED_FORMATS_BY_DATA_TYPE[dataType].includes(`.${ext}`)) {
      setFileProblem(`Arquivo .${ext} não é aceito. Use ${ACCEPTED_FORMATS_BY_DATA_TYPE[dataType].join(", ")}.`);
      return;
    }
    // Lê só o começo (cabeçalho + algumas linhas): CSV inteiro não precisa subir duas vezes.
    if (ext !== "csv" && !(ext === "xlsx" && selected.size <= 3 * 1024 * 1024)) return;
    try {
      const head = ext === "csv" ? new File([selected.slice(0, 64 * 1024)], selected.name, { type: "text/csv" }) : selected;
      const formData = new FormData();
      formData.append("file", head);
      formData.append("data_type", dataType);
      const preview = await apiClient.upload<ColumnMappingPreview>("/api/v1/ingestion/preview-headers", formData);
      if (preview.detected_data_type) setDetected(preview.detected_data_type);
      const savedProblem = Object.entries(preview.saved_mapping ?? {}).find(([header]) => preview.warnings?.[header]);
      if (savedProblem) {
        setSavedMappingWarning(`Mapeamento salvo com problema: a coluna “${savedProblem[0]}” — ${preview.warnings![savedProblem[0]]}`);
      }
    } catch {
      // Conferência é ajuda, não bloqueio: se falhar, o envio segue normal.
    }
  }

  const [sendPercent, setSendPercent] = useState<number | null>(null);
  const mutation = useMutation({
    mutationFn: async (f: File): Promise<{ queued: DirectUploadStatus } | { result: UploadIngestionFileResponse }> => {
      setSendPercent(0);
      // Direto ao armazenamento quando o servidor permite: o arquivo é
      // processado em segundo plano e a tela fica livre (painel "Em
      // processamento"). Senão, pela API — só para arquivos pequenos.
      const queued = await startDirectUpload(f, dataType, { onProgress: (fraction) => setSendPercent(Math.round(fraction * 100)) });
      if (queued) return { queued };
      // Sem upload direto, a API só aceita arquivos pequenos: avisa antes de
      // mandar 20 MB pela rede para receber um 413.
      if (f.size > SYNC_UPLOAD_MAX_BYTES) throw new Error(LARGE_FILE_UNAVAILABLE_MESSAGE);
      setSendPercent(null);
      const formData = new FormData();
      formData.append("file", f);
      formData.append("data_type", dataType);
      const response = await apiClient.upload<UploadIngestionFileResponse | DirectUploadStatus>("/api/v1/ingestion/upload", formData);
      // Auditoria V1, rodada 7 (A1): arquivo grande enviado pela API entra na
      // fila do worker (202 com o status do envio) em vez de segurar a tela
      // por minutos; o acompanhamento é o mesmo do envio direto.
      if ("upload_id" in response) return { queued: response };
      return { result: response };
    },
    onSettled: () => setSendPercent(null),
    onSuccess: (outcome) => {
      setFile(null);
      setDetected(null);
      if ("queued" in outcome) {
        queryClient.invalidateQueries({ queryKey: DIRECT_UPLOADS_QUERY_KEY });
        showSuccess("Arquivo recebido. Acompanhe o andamento logo abaixo — você pode sair desta tela enquanto processa.");
        return;
      }
      const result = outcome.result;
      queryClient.invalidateQueries({ queryKey: ["ingestion-files"] });
      if (result.already_processed || result.retried) {
        showSuccess(result.message ?? "Este arquivo já tinha sido enviado. Nada foi duplicado.");
        if (result.retried && result.error_row_count > 0) setReportFileId(result.id);
      } else if (result.error_row_count > 0) {
        const verdict = importOutcome(result.row_count, result.error_row_count) === "nada" ? showError : showSuccess;
        verdict(`${outcomeSentence(result.row_count, result.error_row_count)} Veja o motivo e como resolver no relatório.`);
        setReportFileId(result.id);
      } else {
        showSuccess(outcomeSentence(result.row_count, 0));
      }
      if (result.created_plans?.length) {
        showSuccess(`Convênios cadastrados a partir do arquivo: ${result.created_plans.join(", ")}. Confira os nomes em Convênios.`);
      }
      // Colunas fora do modelo não entram — avisar em vez de calar.
      if (!result.already_processed && result.ignored_columns?.length && result.message) showError(result.message);
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

  // Auditoria V1, rodada 8 (B2): o auditor vê o histórico e os relatórios
  // das importações (a API já liberava a leitura), sem enviar nada.
  const readOnly = user?.role === "auditor";

  return (
    <div className="space-y-4">
      {!readOnly && (
      <Panel
        title="Enviar planilha"
        subtitle="Escolha o tipo, selecione o arquivo (.xlsx, .csv ou .json) e envie. Você acompanha o resultado aqui e pode sair da tela enquanto processa."
      >
        <div className="p-4">
          <SelectField
            label="Tipo de planilha"
            value={dataType}
            onChange={(e) => {
              setDataType(e.target.value as DataType);
              setDetected(null);
            }}
            className="mb-4 max-w-xs"
          >
            <option value="faturamento">Faturamento</option>
            <option value="agenda">Agenda</option>
            <option value="atendimento">Atendimento</option>
            <option value="estoque">Estoque</option>
            <option value="pep">PEP (Prontuário)</option>
          </SelectField>
          {dataType === "faturamento" && (
            <p className="mb-4 -mt-2 text-2xs text-ink-faint">
              Uma linha por procedimento cobrado. Pode mandar logo depois de faturar e mandar de novo quando o convênio pagar ou glosar —
              a mesma linha (mesmo ID de transação) é atualizada, sem duplicar.
            </p>
          )}
          {dataType === "atendimento" && (
            <p className="mb-4 -mt-2 text-2xs text-ink-faint">
              Horários de cada etapa da visita (chegada, triagem, consultório, saída). Liga sozinho com a agenda e o faturamento
              pelo código do atendimento; pode chegar em qualquer ordem.
            </p>
          )}
          {dataType === "estoque" && (
            <p className="mb-4 -mt-2 text-2xs text-ink-faint">
              Materiais e medicamentos consumidos — vinculados a um atendimento quando o código bate (opcional: reposição
              de almoxarifado sem visita também é aceita).
            </p>
          )}
          {dataType === "pep" && (
            <p className="mb-4 -mt-2 text-2xs text-ink-faint">
              Prontuário (evolução, sinais vitais, alergias, termo de consentimento). O atendimento precisa já estar no sistema
              (pela agenda ou pelo faturamento) antes do prontuário dele.
            </p>
          )}
          <TemplateGuide template={template} />
          <Dropzone
            accept={ACCEPTED_FORMATS_BY_DATA_TYPE[dataType]}
            hint={dataType === "agenda" ? "Excel (.xlsx), CSV, XML ou JSON — até 20 MB" : "Excel (.xlsx), CSV ou JSON — até 20 MB"}
            file={file}
            onFileSelected={handleFileSelected}
            isUploading={mutation.isPending}
          />
          {fileProblem && (
            <p role="alert" className="mt-2 text-xs text-denied">
              {fileProblem}
            </p>
          )}
          {detected && detected !== dataType && (
            <div role="status" className="mt-3 flex flex-wrap items-center gap-3 rounded-md border border-pending/30 bg-pending/[6%] px-3 py-2 text-xs text-ink">
              <span>
                Este arquivo parece de <strong>{DATA_TYPE_LABELS[detected] ?? detected}</strong>, não de {DATA_TYPE_LABELS[dataType]}.
              </span>
              <Button type="button" size="xs" onClick={() => setDataType(detected as DataType)}>
                Enviar como {DATA_TYPE_LABELS[detected] ?? detected}
              </Button>
            </div>
          )}
          {savedMappingWarning && (
            <div role="status" className="mt-3 flex flex-wrap items-center gap-3 rounded-md border border-denied/30 bg-denied-bg px-3 py-2 text-xs text-ink">
              <span>{savedMappingWarning}</span>
              <Button type="button" size="xs" variant="secondary" onClick={() => setIsMappingModalOpen(true)}>
                Corrigir mapeamento
              </Button>
            </div>
          )}
          <div className="mt-4 flex justify-end gap-2">
            {/\.(csv|xlsx)$/.test(file?.name.toLowerCase() ?? "") && (
              <Button type="button" variant="secondary" onClick={() => setIsMappingModalOpen(true)} className="flex items-center gap-1.5">
                <Wand2 size={14} />
                Mapear colunas
              </Button>
            )}
            <Button disabled={!file || !!fileProblem || mutation.isPending} onClick={() => file && mutation.mutate(file)}>
              {mutation.isPending ? (sendPercent !== null && sendPercent > 0 ? `Enviando ${sendPercent}%` : "Enviando...") : "Enviar arquivo"}
            </Button>
          </div>
          <p className="mt-2 text-2xs text-ink-faint">
            O seu sistema usa outros nomes de coluna? Clique em “Mapear colunas” antes de enviar e diga qual é qual.
          </p>
          <SavedMappings dataType={dataType} template={template} />
        </div>
      </Panel>

      )}

      <ColumnMappingModal
        file={file}
        dataType={dataType}
        template={template}
        isOpen={isMappingModalOpen}
        onClose={() => setIsMappingModalOpen(false)}
      />
      <UploadReportModal fileId={reportFileId} onClose={() => setReportFileId(null)} />
      <UndoImportModal file={undoFile} onClose={() => setUndoFile(null)} />
      {!readOnly && <BackgroundImportsPanel onOpenReport={setReportFileId} />}

      <Panel
        title="Histórico de importações"
        subtitle="Últimos arquivos enviados por esta clínica, mais recente primeiro"
        glow={(history?.items ?? []).some((f) => f.error_row_count > 0) ? "pending" : "none"}
      >
        {isLoading && <LoadingState variant="table" rows={4} />}
        {error && <ErrorState message={getApiErrorMessage(error)} onRetry={() => refetch()} />}
        {!isLoading && !error && (history?.items ?? []).length === 0 && (
          <EmptyState icon={<UploadCloud size={17} strokeWidth={1.5} />} message="Nenhum arquivo enviado ainda — o primeiro aparece aqui assim que for processado." />
        )}
          {!isLoading && (history?.items ?? []).length > 0 && (
            <>
            {/* Celular (UX-27): cartões com o que importa (situação e linhas). */}
            <ul className="divide-y divide-border-hairline md:hidden">
              {(history?.items ?? []).map((f) => (
                <li key={f.id} className="flex flex-col gap-1.5 px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0 break-all text-sm font-medium text-ink">{f.original_filename ?? "—"}</span>
                    <FileOutcomeBadge file={f} />
                  </div>
                  <span className="text-2xs text-ink-faint">
                    {DATA_TYPE_LABELS[f.data_type] ?? f.data_type} · {formatDateTime(f.received_at)}
                  </span>
                  {f.status === "processed" && !f.undone_at && <span className="text-xs text-ink-muted">{outcomeSentence(f.row_count, f.error_row_count)}</span>}
                  <FileActions file={f} canUndo={canUndo} onReport={setReportFileId} onUndo={setUndoFile} />
                </li>
              ))}
            </ul>
            <table className="hidden w-full text-left text-sm md:table">
              <thead>
                <tr className="border-b border-border-hairline text-xs text-ink-muted">
                  <th className="px-4 py-2.5 font-medium">Arquivo</th>
                  <th className="px-4 py-2.5 font-medium">Tipo</th>
                  <th className="px-4 py-2.5 font-medium">Situação</th>
                  <th className="px-4 py-2.5 font-medium">Importadas</th>
                  <th className="px-4 py-2.5 font-medium">Com problema</th>
                  <th className="px-4 py-2.5 font-medium">Recebido em</th>
                  <th className="px-4 py-2.5 font-medium">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {(history?.items ?? []).map((f) => (
                  <tr key={f.id} className="border-b border-border-hairline last:border-0 transition-colors hover:bg-canvas-raised/60">
                    <td className="px-4 py-2.5 text-ink">
                      {f.original_filename ?? "—"}
                      <span className="ml-1.5 text-2xs uppercase text-ink-faint">{f.file_format}</span>
                    </td>
                    <td className="px-4 py-2.5 text-ink-muted">{DATA_TYPE_LABELS[f.data_type] ?? f.data_type}</td>
                    <td className="px-4 py-2.5">
                      <FileOutcomeBadge file={f} />
                    </td>
                    {/* UX-03: antes esta coluna mostrava as linhas LIDAS (8.746 "importadas" com 0 importada). */}
                    <td className="tabular px-4 py-2.5 text-ink-muted">
                      {f.status === "processed" ? formatCount(Math.max(0, f.row_count - f.error_row_count)) : "—"}
                    </td>
                    <td className={`tabular px-4 py-2.5 ${f.error_row_count > 0 ? "text-denied" : "text-ink-muted"}`}>
                      {f.error_row_count > 0 ? formatCount(f.error_row_count) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-ink-muted">{formatDateTime(f.received_at)}</td>
                    <td className="px-4 py-2.5">
                      <FileActions file={f} canUndo={canUndo} onReport={setReportFileId} onUndo={setUndoFile} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </>
          )}
        {history && history.total > 0 && (
          <Pagination total={history.total} limit={HISTORY_PAGE_SIZE} offset={offset} onOffsetChange={setOffset} label="Paginação do histórico de envios" />
        )}
      </Panel>
    </div>
  );
}

function FileOutcomeBadge({ file }: { file: IngestionFileEntry }) {
  if (file.undone_at) return <Badge tone="neutral">Desfeita</Badge>;
  if (file.status !== "processed") return <Badge tone={STATUS_TONE[file.status] ?? "neutral"}>{STATUS_LABELS[file.status] ?? file.status}</Badge>;
  const outcome = importOutcome(file.row_count, file.error_row_count);
  return <Badge tone={OUTCOME_TONE[outcome]}>{OUTCOME_LABEL[outcome]}</Badge>;
}

function FileActions({
  file,
  canUndo,
  onReport,
  onUndo,
}: {
  file: IngestionFileEntry;
  canUndo: boolean;
  onReport: (id: string) => void;
  onUndo: (file: IngestionFileEntry) => void;
}) {
  if (file.status !== "processed") return null;
  const hasProblems = file.error_row_count > 0 && !file.undone_at;
  return (
    <div className="flex items-center gap-2">
      <Button type="button" size="xs" variant={hasProblems ? "primary" : "secondary"} onClick={() => onReport(file.id)}>
        {hasProblems ? "Ver e resolver" : "Relatório"}
      </Button>
      {/* Qualidade percebida: "Desfazer" em vermelho ao lado do sucesso confundia;
          fica neutro aqui, e a confirmação (com o que será apagado) é no diálogo. */}
      {canUndo && !file.undone_at && (
        <Button type="button" size="xs" variant="ghost" onClick={() => onUndo(file)} aria-label={`Desfazer importação de ${file.original_filename ?? "arquivo"}`}>
          Desfazer
        </Button>
      )}
    </div>
  );
}

/**
 * "Desfazer importação": mostra antes o que vai ser apagado/restaurado e
 * só então confirma. Depois o mesmo arquivo (ou a versão corrigida) pode
 * ser enviado de novo.
 */
export function UndoImportModal({ file, onClose }: { file: IngestionFileEntry | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const previewQuery = useQuery({
    queryKey: ["ingestion-undo-preview", file?.id],
    queryFn: () => apiClient.get<IngestionUndoResponse>(`/api/v1/ingestion/files/${file?.id}/undo-preview`),
    enabled: !!file,
    staleTime: 0,
    gcTime: 0,
  });
  const undoMutation = useMutation({
    // Arquivo com centenas de milhares de linhas leva até ~1 min no servidor.
    mutationFn: () => apiClient.post<IngestionUndoResponse>(`/api/v1/ingestion/files/${file?.id}/undo`, undefined, { timeoutMs: 5 * 60_000 }),
    onSuccess: (result) => {
      // Os números de todas as telas mudam: recarrega tudo que estiver em cache.
      queryClient.invalidateQueries();
      showSuccess(result.message);
      onClose();
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });
  const preview = previewQuery.data;
  const items = Object.entries(preview?.deleted ?? {}).filter(([, n]) => n > 0);
  // Registros criados pelo arquivo e editados depois: o desfazer apaga as
  // edições junto — exige confirmação explícita (auditoria V1, rodada 3).
  const [acceptLoss, setAcceptLoss] = useState(false);
  useEffect(() => setAcceptLoss(false), [file?.id]);
  const conflicts = preview?.conflicts ?? 0;
  const edited = preview?.edited_after_import ?? 0;
  const blocked = conflicts > 0;

  return (
    <Modal title="Desfazer importação" isOpen={!!file} onClose={onClose}>
      <div className="space-y-3 text-sm">
        <p className="text-ink-muted">
          Arquivo <span className="font-medium text-ink">{file?.original_filename ?? "sem nome"}</span>. Tudo o que ele criou é
          apagado e o que ele alterou volta a ser como era antes. Depois você pode enviar o arquivo corrigido.
        </p>
        {previewQuery.isLoading && <LoadingState variant="table" rows={2} />}
        {previewQuery.error && <p className="text-xs text-denied">{getApiErrorMessage(previewQuery.error)}</p>}
        {preview && (
          <>
            {items.length > 0 ? (
              <ul className="list-disc space-y-0.5 pl-5 text-ink" aria-label="O que será apagado">
                {items.map(([label, n]) => (
                  <li key={label}>
                    <span className="tabular">{n}</span> {label}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-ink-muted">Nenhum registro deste arquivo continua no sistema.</p>
            )}
            {preview.restored > 0 && (
              <p className="text-ink-muted">
                <span className="tabular">{preview.restored}</span> {word(preview.restored, "registro alterado por este arquivo volta", "registros alterados por este arquivo voltam")} ao valor anterior.
              </p>
            )}
            {preview.appeals_removed > 0 && (
              <p role="alert" className="rounded-md border border-denied/30 bg-denied-bg px-3 py-2 text-xs text-denied">
                Atenção: {plural(preview.appeals_removed, "recurso de glosa aberto", "recursos de glosa abertos")} sobre essas cobranças também {word(preview.appeals_removed, "será apagado", "serão apagados")}.
              </p>
            )}
            {blocked && (
              <p role="alert" className="rounded-md border border-denied/30 bg-denied-bg px-3 py-2 text-xs text-denied">
                Não é possível desfazer agora: <span className="tabular">{conflicts}</span> {word(conflicts, "registro", "registros")} desta importação mudaram depois dela
                (por um arquivo enviado depois ou por uma alteração na tela, como uma baixa de pagamento). Desfaça primeiro as importações
                mais recentes e reverta as alterações manuais.
              </p>
            )}
            {!blocked && edited > 0 && (
              <label className="flex items-start gap-2 rounded-md border border-pending/30 bg-pending-bg px-3 py-2 text-xs text-ink">
                <input type="checkbox" className="mt-0.5" checked={acceptLoss} onChange={(e) => setAcceptLoss(e.target.checked)} />
                <span>
                  <span className="tabular">{edited}</span> {word(edited, "registro criado", "registros criados")} por esta importação foram editados depois (por exemplo, faltas marcadas
                  na tela). Entendo que essas edições serão perdidas.
                </span>
              </label>
            )}
          </>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={undoMutation.isPending}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => undoMutation.mutate()}
            disabled={!preview || undoMutation.isPending || blocked || (edited > 0 && !acceptLoss)}
          >
            {undoMutation.isPending ? "Desfazendo..." : "Desfazer importação"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

const UPLOAD_STATE_LABELS: Record<string, string> = {
  aguardando_envio: "Enviando",
  na_fila: "Na fila",
  processando: "Processando",
  processado: "Concluído",
  falhou: "Falhou",
};

/**
 * Importações em segundo plano (upload direto): progresso de cada arquivo,
 * atualizado a cada 2 s enquanto houver algum em andamento. A pessoa pode
 * sair da tela e voltar — o andamento vem do servidor.
 */
export function BackgroundImportsPanel({ onOpenReport }: { onOpenReport: (fileId: string) => void }) {
  const { data } = useDirectUploads();
  const uploads = data ?? [];
  const active = uploads.filter((u) => ACTIVE_STATES.includes(u.status));
  // UX-19: a lista acumulava tudo dos últimos 30 min (até 7 itens, o mesmo
  // arquivo repetido) sob o título "Em processamento". Agora: o que está
  // rodando, e os 3 últimos concluídos, um por arquivo.
  const seen = new Set<string>();
  const finished = uploads
    .filter((u) => !ACTIVE_STATES.includes(u.status))
    .filter((u) => {
      const key = `${u.original_filename}|${u.data_type}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 3);
  if (active.length === 0 && finished.length === 0) return null;

  return (
    <Panel
      title={active.length > 0 ? "Em andamento" : "Concluídas agora"}
      subtitle={active.length > 0 ? "Pode sair desta tela: o arquivo continua sendo processado e o resultado aparece aqui e no histórico." : "Resultado dos últimos envios."}
    >
      <ul className="divide-y divide-border-hairline">
        {[...active, ...finished].map((upload) => (
          <BackgroundImportItem key={upload.upload_id} upload={upload} onOpenReport={onOpenReport} />
        ))}
      </ul>
    </Panel>
  );
}

function BackgroundImportItem({ upload, onOpenReport }: { upload: DirectUploadStatus; onOpenReport: (fileId: string) => void }) {
  const percent = processingPercent(upload);
  const isActive = ACTIVE_STATES.includes(upload.status);
  const name = upload.original_filename ?? "Arquivo";
  const outcome = upload.status === "processado" ? importOutcome(upload.row_count, upload.error_row_count) : null;
  const badge =
    upload.status === "falhou"
      ? { tone: "denied" as const, label: "Falhou" }
      : outcome
        ? { tone: OUTCOME_TONE[outcome], label: upload.already_processed ? "Já estava no sistema" : OUTCOME_LABEL[outcome] }
        : { tone: "pending" as const, label: UPLOAD_STATE_LABELS[upload.status] ?? upload.status };
  return (
    <li className="space-y-1.5 px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="min-w-0 break-all font-medium text-ink">{name}</span>
        <span className="flex items-center gap-2">
          <span className="text-2xs text-ink-faint">{DATA_TYPE_LABELS[upload.data_type ?? ""] ?? upload.data_type}</span>
          <Badge tone={badge.tone}>{badge.label}</Badge>
        </span>
      </div>
      {isActive && (
        <>
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-border-subtle"
            role="progressbar"
            aria-label={`Progresso de ${name}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent ?? undefined}
          >
            <div
              className={percent === null ? "h-full w-1/3 animate-pulse rounded-full bg-accent" : "h-full rounded-full bg-accent transition-all"}
              style={percent === null ? undefined : { width: `${percent}%` }}
            />
          </div>
          <p className={upload.queue_delayed ? "text-2xs text-pending" : "text-2xs text-ink-faint"} role={upload.queue_delayed ? "status" : undefined}>
            {upload.queue_delayed
              ? (upload.queue_message ?? "O processamento está atrasado. O arquivo continua guardado.")
              : upload.status === "na_fila"
                ? "Aguardando a vez — começa em instantes."
                : percent === null
                  ? "Lendo a planilha…"
                  : `${formatCount(upload.processed_rows)} de ${formatCount(upload.total_rows)} linhas (${percent}%)`}
          </p>
        </>
      )}
      {upload.status === "processado" && (
        <div className="flex flex-wrap items-center gap-3 text-xs text-ink-muted">
          <span>
            {upload.already_processed || upload.retried
              ? (upload.message ?? "Este arquivo já tinha sido enviado. Nada foi duplicado.")
              : outcomeSentence(upload.row_count, upload.error_row_count)}
          </span>
          {!upload.already_processed && upload.ignored_columns && upload.ignored_columns.length > 0 && (
            <span className="text-pending">Colunas que não fazem parte do modelo (não entraram): {upload.ignored_columns.join(", ")}</span>
          )}
          {upload.ingestion_file_id && !upload.already_processed && (
            <Button
              type="button"
              size="xs"
              variant={(upload.error_row_count ?? 0) > 0 ? "primary" : "secondary"}
              onClick={() => onOpenReport(upload.ingestion_file_id!)}
            >
              {(upload.error_row_count ?? 0) > 0 ? "Ver e resolver" : "Relatório"}
            </Button>
          )}
        </div>
      )}
      {upload.status === "falhou" && <p className="text-xs text-denied">{upload.error ?? "Não foi possível processar o arquivo."}</p>}
    </li>
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
      showSuccess("PDF enviado. Em Convênios › Contratos, leia a tabela de preços e aprove.");
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
      title="Enviar contrato de convênio"
      subtitle="PDF do contrato. O Insighta lê a tabela de preços e você confere antes de aprovar — nada vale sem a sua revisão."
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
  // Estados (voltar do navegador): a aba fica no endereço (?aba=contratos).
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: Tab = searchParams.get("aba") === "contratos" ? "contratos" : "lotes";
  const setTab = (next: Tab) => {
    const params = new URLSearchParams(searchParams);
    if (next === "contratos") params.set("aba", "contratos");
    else params.delete("aba");
    setSearchParams(params);
  };
  const { user } = useAuth();

  if (user?.role === "auditor") {
    return (
      <div className="space-y-6">
        <PageHeader
          icon={UploadCloud}
          title="Importações"
          subtitle="Histórico dos arquivos importados pela clínica e o relatório de cada um, em modo leitura."
        />
        <BatchUploadTab />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={UploadCloud}
        title="Importar dados"
        subtitle="Envie as planilhas que o sistema da sua clínica exporta. Cada tipo tem um modelo para baixar."
      />

      <ImportDataNav />

      <Tabs
        groupId={TABS_GROUP}
        active={tab}
        onChange={(id) => setTab(id as Tab)}
        items={[
          { id: "lotes", label: "Planilhas" },
          { id: "contratos", label: "Contratos de convênio (PDF)" },
        ]}
      />

      {tab === "lotes" ? (
        <TabPanel id="lotes" groupId={TABS_GROUP}>
          <BatchUploadTab />
        </TabPanel>
      ) : (
        <TabPanel id="contratos" groupId={TABS_GROUP}>
          <ContractUploadTab />
        </TabPanel>
      )}
    </div>
  );
}
