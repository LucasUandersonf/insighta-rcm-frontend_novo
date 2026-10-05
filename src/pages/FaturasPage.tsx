import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Plus, Receipt } from "lucide-react";
import { Panel, EmptyState, LoadingState, ErrorState } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { TextField } from "@/components/ui/FormField";
import { Pagination } from "@/components/ui/Pagination";
import { PageHeader } from "@/components/ui/PageHeader";
import { apiClient } from "@/lib/api-client";
import { ConfirmationDeclined, withConfirmation } from "@/lib/confirmable";
import { getApiErrorMessage } from "@/lib/query-client";
import { useToast } from "@/context/ToastContext";
import { useAuth } from "@/context/AuthContext";
import type {
  Fatura,
  FaturaCreateRequest,
  FaturaSettleRequest,
  FaturaStatus,
  FaturaSummary,
  InsurancePlan,
  Lote,
  PaginatedResponse,
} from "@/lib/types";

const FATURAS_PAGE_SIZE = 20;

const STATUS_LABELS: Record<FaturaStatus, string> = {
  emitida: "Emitida",
  parcialmente_paga: "Paga em parte",
  paga: "Paga",
  cancelada: "Cancelada",
};

const STATUS_TONE: Record<FaturaStatus, BadgeTone> = {
  emitida: "pending",
  parcialmente_paga: "neutral",
  paga: "revenue",
  cancelada: "neutral",
};

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function money(value: number | null): string {
  return value === null ? "—" : brl.format(value);
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));
}

function faturaLabel(f: Pick<Fatura, "serie" | "numero">): string {
  if (!f.numero) return "Sem número";
  return f.serie ? `${f.serie}-${f.numero}` : f.numero;
}

/** "1.234,56" ou "1234.56" → 1234.56; texto inválido → NaN. */
export function parseMoney(raw: string): number {
  const cleaned = raw.trim().replace(/\s|R\$/g, "");
  const normalized = cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned;
  return normalized === "" ? NaN : Number(normalized);
}

// ---------------------------------------------------------------------
// Nova fatura: escolhe lotes fechados do mesmo convênio
// ---------------------------------------------------------------------

function CreateFaturaModal({
  isOpen,
  onClose,
  planNameById,
}: {
  isOpen: boolean;
  onClose: () => void;
  planNameById: Map<string, string>;
}) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [selected, setSelected] = useState<string[]>([]);
  const [serie, setSerie] = useState("");
  const [numero, setNumero] = useState("");

  const lotesQuery = useQuery({
    queryKey: ["lotes", "fechado", "para-fatura"],
    queryFn: () => apiClient.get<PaginatedResponse<Lote>>("/api/v1/lotes?status=fechado&limit=200&offset=0"),
    enabled: isOpen,
  });
  const lotes = lotesQuery.data?.items ?? [];
  const selectedPlan = lotes.find((l) => l.id === selected[0])?.insurance_plan_id ?? null;

  const mutation = useMutation({
    mutationFn: (payload: FaturaCreateRequest) => apiClient.post<Fatura>("/api/v1/faturas", payload),
    onSuccess: (fatura) => {
      queryClient.invalidateQueries({ queryKey: ["faturas"] });
      queryClient.invalidateQueries({ queryKey: ["lotes"] });
      showSuccess(`Fatura ${faturaLabel(fatura)} gerada. Quando a operadora pagar, dê baixa nela aqui.`);
      resetAndClose();
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  function resetAndClose() {
    setSelected([]);
    setSerie("");
    setNumero("");
    onClose();
  }

  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (selected.length === 0 || mutation.isPending) return;
    mutation.mutate({ lote_ids: selected, serie: serie.trim() || null, numero: numero.trim() || null });
  }

  return (
    <Modal title="Nova fatura" isOpen={isOpen} onClose={resetAndClose}>
      <form onSubmit={handleSubmit}>
        <p className="mb-4 text-xs text-ink-faint">
          Escolha um ou mais lotes fechados do mesmo convênio. Lotes ainda abertos aparecem aqui depois de fechados em Lotes.
        </p>
        {lotesQuery.isLoading && <LoadingState variant="table" rows={2} />}
        {lotesQuery.error && <ErrorState message={getApiErrorMessage(lotesQuery.error)} onRetry={() => lotesQuery.refetch()} />}
        {!lotesQuery.isLoading && !lotesQuery.error && lotes.length === 0 && (
          <p className="mb-4 text-xs text-ink-faint">Nenhum lote fechado esperando fatura.</p>
        )}
        {lotes.length > 0 && (
          <fieldset className="mb-4">
            <legend className="mb-2 text-2xs font-medium uppercase tracking-wide text-ink-faint">Lotes fechados</legend>
            <ul className="divide-y divide-border-subtle">
              {lotes.map((l) => {
                const otherPlan = selectedPlan !== null && l.insurance_plan_id !== selectedPlan;
                return (
                  <li key={l.id} className="py-2 text-sm">
                    <label className={otherPlan ? "flex items-center gap-2 text-ink-faint" : "flex items-center gap-2 text-ink"}>
                      <input
                        type="checkbox"
                        checked={selected.includes(l.id)}
                        disabled={otherPlan}
                        onChange={() => toggle(l.id)}
                      />
                      {planNameById.get(l.insurance_plan_id) ?? "Convênio"} · {l.guias_count} guia(s) · fechado em {formatDate(l.closed_at)}
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField label="Série" maxLength={10} value={serie} onChange={(e) => setSerie(e.target.value)} placeholder="Ex.: NF" />
          <TextField label="Número" maxLength={30} value={numero} onChange={(e) => setNumero(e.target.value)} />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={resetAndClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={mutation.isPending || selected.length === 0}>
            {mutation.isPending ? "Gerando..." : "Gerar fatura"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------
// Baixa
// ---------------------------------------------------------------------

function SettleModal({ fatura, onClose }: { fatura: Fatura | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [valor, setValor] = useState("");
  const [isPartial, setIsPartial] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const isCorrection = fatura?.status === "paga";

  const mutation = useMutation({
    mutationFn: (payload: FaturaSettleRequest) =>
      withConfirmation((confirmation) =>
        apiClient.post<Fatura>(`/api/v1/faturas/${fatura!.id}/baixar`, { ...payload, ...confirmation })
      ),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["faturas"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      showSuccess(
        updated.status === "paga"
          ? `Baixa registrada. As ${updated.cobrancas} cobrança(s) da fatura foram marcadas como pagas.`
          : "Baixa parcial registrada. As cobranças continuam em aberto até a baixa final."
      );
      resetAndClose();
    },
    onError: (err) => {
      if (!(err instanceof ConfirmationDeclined)) showError(getApiErrorMessage(err));
    },
  });

  function resetAndClose() {
    setValor("");
    setIsPartial(false);
    setFieldError(null);
    onClose();
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (mutation.isPending) return;
    const value = parseMoney(valor);
    if (!Number.isFinite(value) || value <= 0) {
      setFieldError("Informe o valor recebido, maior que zero (ex.: 1.250,00).");
      return;
    }
    setFieldError(null);
    mutation.mutate({ valor_recebido: value, is_partial: isPartial, correction: isCorrection });
  }

  if (!fatura) return null;
  return (
    <Modal title={`${isCorrection ? "Corrigir baixa" : "Dar baixa"} — fatura ${faturaLabel(fatura)}`} isOpen onClose={resetAndClose}>
      <form onSubmit={handleSubmit}>
        <p className="mb-4 text-xs text-ink-faint">
          Total cobrado nas guias: <strong className="text-ink">{money(fatura.valor_total)}</strong> em {fatura.cobrancas} cobrança(s).
          Na baixa total, o valor é dividido entre as cobranças em aberto na proporção do que se espera de cada uma, e elas
          passam a contar como recebidas nos painéis.
        </p>
        <TextField
          label="Valor recebido (R$)"
          inputMode="decimal"
          required
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          error={fieldError ?? undefined}
        />
        {!isCorrection && (
          <label className="mt-3 flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={isPartial} onChange={(e) => setIsPartial(e.target.checked)} />
            Pagamento parcial (a operadora ainda vai pagar o resto)
          </label>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={resetAndClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Registrando..." : isCorrection ? "Corrigir baixa" : "Registrar baixa"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------

/**
 * Auditoria V1, rodada 10 (A1): o fluxo parava em "Lote fechado — pronto
 * para virar fatura" sem tela de fatura. Aqui a equipe gera a fatura a partir
 * dos lotes fechados, dá baixa quando a operadora paga (as cobranças passam a
 * contar como recebidas) e cancela uma fatura gerada por engano.
 */
export function FaturasPage() {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [offset, setOffset] = useState(0);
  const [settling, setSettling] = useState<Fatura | null>(null);
  const [cancelling, setCancelling] = useState<Fatura | null>(null);

  const allPlansQuery = useQuery({
    queryKey: ["insurance-plans", "all"],
    queryFn: () => apiClient.get<InsurancePlan[]>("/api/v1/insurance-companies/plans?include_inactive=true"),
  });
  const planNameById = new Map((allPlansQuery.data ?? []).map((p) => [p.id, p.display_name]));

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["faturas", offset],
    queryFn: () => apiClient.get<PaginatedResponse<Fatura>>(`/api/v1/faturas?limit=${FATURAS_PAGE_SIZE}&offset=${offset}`),
  });
  const faturas = data?.items ?? [];

  // Rodada 11 (B4): auditor só lê — as ações ficam escondidas (a API também recusa).
  const { user } = useAuth();
  const canWrite = !!user && ["owner", "admin", "financeiro"].includes(user.role);

  // Rodada 11 (M1): o recebido em baixas parciais aparece aqui.
  const summaryQuery = useQuery({
    queryKey: ["faturas", "resumo"],
    queryFn: () => apiClient.get<FaturaSummary>("/api/v1/faturas/resumo"),
  });

  const cancelMutation = useMutation({
    // Rodada 11 (M1): com baixa parcial, a API pede confirmação antes de cancelar.
    mutationFn: (id: string) =>
      withConfirmation((confirmation) => apiClient.post<Fatura>(`/api/v1/faturas/${id}/cancelar`, confirmation)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["faturas"] });
      queryClient.invalidateQueries({ queryKey: ["lotes"] });
      showSuccess("Fatura cancelada. Os lotes voltaram para “fechado” e podem ser faturados de novo ou reabertos.");
      setCancelling(null);
    },
    onError: (err) => {
      setCancelling(null);
      if (!(err instanceof ConfirmationDeclined)) showError(getApiErrorMessage(err));
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Receipt}
        title="Faturas"
        subtitle="Gere a fatura a partir dos lotes fechados e dê baixa quando a operadora pagar. A baixa total marca as cobranças como recebidas."
        action={
          canWrite ? (
            <Button onClick={() => setIsCreateOpen(true)} className="flex items-center gap-1.5">
              <Plus size={14} />
              Nova fatura
            </Button>
          ) : undefined
        }
      />

      {summaryQuery.data && (summaryQuery.data.emitidas > 0 || summaryQuery.data.parciais > 0) && (
        <Panel>
          <dl className="grid grid-cols-1 gap-4 px-4 py-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-2xs uppercase tracking-wide text-ink-faint">Emitidas, aguardando pagamento</dt>
              <dd className="tabular text-ink">
                {summaryQuery.data.emitidas} · {money(summaryQuery.data.emitidas_valor)}
              </dd>
            </div>
            <div>
              <dt className="text-2xs uppercase tracking-wide text-ink-faint">Recebido em baixas parciais</dt>
              <dd className="tabular text-ink">
                {money(summaryQuery.data.parciais_recebido)} em {summaryQuery.data.parciais} fatura(s)
              </dd>
            </div>
            <div>
              <dt className="text-2xs uppercase tracking-wide text-ink-faint">Falta receber nessas faturas</dt>
              <dd className="tabular text-ink">{money(summaryQuery.data.parciais_a_receber)}</dd>
            </div>
          </dl>
          <p className="px-4 pb-3 text-2xs text-ink-faint">
            O recebido parcial entra nas cobranças na baixa final da fatura, para não aparecer como “pagou a menos” antes da hora.
          </p>
        </Panel>
      )}

      <Panel>
        {isLoading && <LoadingState variant="table" rows={4} />}
        {error && <ErrorState message={getApiErrorMessage(error)} onRetry={() => refetch()} />}
        {!isLoading && !error && faturas.length === 0 && (
          <EmptyState icon={<FileText size={17} strokeWidth={1.5} />} message="Nenhuma fatura ainda. Feche um lote em Lotes e gere a fatura aqui." />
        )}
        {!isLoading && faturas.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border-hairline text-2xs uppercase tracking-wide text-ink-faint">
                  <th className="px-4 py-2.5 font-medium">Fatura</th>
                  <th className="px-4 py-2.5 font-medium">Convênio</th>
                  <th className="px-4 py-2.5 font-medium">A receber</th>
                  <th className="px-4 py-2.5 font-medium">Recebido</th>
                  <th className="px-4 py-2.5 font-medium">Cobranças em aberto</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {faturas.map((f) => (
                  <tr key={f.id} className="border-b border-border-hairline last:border-0">
                    <td className="px-4 py-2.5 text-ink">
                      {faturaLabel(f)} <span className="text-2xs text-ink-faint">— {formatDate(f.data_emissao)}</span>
                    </td>
                    <td className="px-4 py-2.5 text-ink-muted">{planNameById.get(f.insurance_plan_id) ?? "—"}</td>
                    <td className="tabular px-4 py-2.5 text-ink-muted">
                      {money(f.valor_total)}
                      {f.valor_negado > 0 && (
                        <span className="block text-2xs text-ink-faint">+ {money(f.valor_negado)} negado</span>
                      )}
                    </td>
                    <td className="tabular px-4 py-2.5 text-ink-muted">{money(f.valor_recebido)}</td>
                    <td className="tabular px-4 py-2.5 text-ink-muted">
                      {f.status === "cancelada" ? "—" : `${f.cobrancas_pendentes} de ${f.cobrancas}`}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge tone={STATUS_TONE[f.status]}>{STATUS_LABELS[f.status]}</Badge>
                    </td>
                    <td className="space-x-1 whitespace-nowrap px-4 py-2.5 text-right">
                      {canWrite && f.status !== "cancelada" && (
                        <Button variant="ghost" size="xs" onClick={() => setSettling(f)}>
                          {f.status === "paga" ? "Corrigir baixa" : "Dar baixa"}
                        </Button>
                      )}
                      {canWrite && (f.status === "emitida" || f.status === "parcialmente_paga") && (
                        <Button variant="ghost" size="xs" onClick={() => setCancelling(f)}>
                          Cancelar
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && data.total > 0 && (
          <Pagination total={data.total} limit={FATURAS_PAGE_SIZE} offset={offset} onOffsetChange={setOffset} label="Paginação de faturas" />
        )}
      </Panel>

      <CreateFaturaModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} planNameById={planNameById} />
      <SettleModal fatura={settling} onClose={() => setSettling(null)} />
      <ConfirmDialog
        isOpen={!!cancelling}
        title="Cancelar fatura"
        message={
          cancelling
            ? `A fatura ${faturaLabel(cancelling)} fica cancelada (continua no histórico) e os lotes dela voltam para “fechado”. O número pode ser usado de novo.`
            : ""
        }
        confirmLabel="Cancelar fatura"
        cancelLabel="Voltar"
        onConfirm={() => cancelling && cancelMutation.mutate(cancelling.id)}
        onCancel={() => setCancelling(null)}
        isConfirming={cancelMutation.isPending}
      />
    </div>
  );
}
