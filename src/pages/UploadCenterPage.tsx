import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UploadCloud } from "lucide-react";
import { Panel, EmptyState, LoadingState, ErrorState } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Dropzone } from "@/components/ui/Dropzone";
import { SelectField, TextField } from "@/components/ui/FormField";
import { Pagination } from "@/components/ui/Pagination";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { useToast } from "@/context/ToastContext";
import type {
  Contract,
  IngestionFileEntry,
  InsurancePlan,
  PaginatedResponse,
  UploadIngestionFileResponse,
} from "@/lib/types";

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

function BatchUploadTab() {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [offset, setOffset] = useState(0);

  const mutation = useMutation({
    mutationFn: (f: File) => {
      const formData = new FormData();
      formData.append("file", f);
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
        subtitle="CSV, XML ou JSON — faturamento, agenda ou repasses do seu ERP. Processado na hora: você vê o resultado nesta mesma tela."
      >
        <div className="p-4">
          <Dropzone
            accept={[".csv", ".xml", ".json"]}
            hint="CSV, XML ou JSON — até 20MB"
            file={file}
            onFileSelected={setFile}
            isUploading={mutation.isPending}
          />
          <div className="mt-4 flex justify-end">
            <Button disabled={!file || mutation.isPending} onClick={() => file && mutation.mutate(file)}>
              {mutation.isPending ? "Enviando..." : "Enviar arquivo"}
            </Button>
          </div>
        </div>
      </Panel>

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
