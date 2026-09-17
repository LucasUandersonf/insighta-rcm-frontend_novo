import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileStack, Receipt } from "lucide-react";
import { Panel, EmptyState, LoadingState, ErrorState } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { TextField, SelectField } from "@/components/ui/FormField";
import { Pagination } from "@/components/ui/Pagination";
import { PageHeader } from "@/components/ui/PageHeader";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { useToast } from "@/context/ToastContext";
import type {
  Fatura,
  FaturaCreateRequest,
  FaturaSettleRequest,
  FaturaStatus,
  InsurancePlan,
  Lote,
  PaginatedResponse,
} from "@/lib/types";

const FATURAS_PAGE_SIZE = 20;

const STATUS_LABELS: Record<FaturaStatus, string> = {
  emitida: "Emitida",
  paga: "Paga",
  parcialmente_paga: "Parcialmente paga",
  cancelada: "Cancelada",
};

const STATUS_TONE: Record<FaturaStatus, BadgeTone> = {
  emitida: "pending",
  paga: "revenue",
  parcialmente_paga: "pending",
  cancelada: "denied",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));
}

function formatCurrency(value: number | null): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

// ---------------------------------------------------------------------
// Nova fatura (a partir de lotes FECHADOS do mesmo convênio)
// ---------------------------------------------------------------------

function CreateFaturaModal({
  isOpen,
  onClose,
  plans,
  closedLotes,
}: {
  isOpen: boolean;
  onClose: () => void;
  plans: InsurancePlan[];
  closedLotes: Lote[];
}) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [insurancePlanId, setInsurancePlanId] = useState("");
  const [selectedLoteIds, setSelectedLoteIds] = useState<string[]>([]);
  const [serie, setSerie] = useState("");
  const [numero, setNumero] = useState("");

  const eligibleLotes = closedLotes.filter((l) => l.insurance_plan_id === insurancePlanId);

  const mutation = useMutation({
    mutationFn: (payload: FaturaCreateRequest) => apiClient.post<Fatura>("/api/v1/faturas", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["faturas"] });
      queryClient.invalidateQueries({ queryKey: ["lotes"] });
      showSuccess("Fatura gerada.");
      resetAndClose();
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  function resetAndClose() {
    setInsurancePlanId("");
    setSelectedLoteIds([]);
    setSerie("");
    setNumero("");
    onClose();
  }

  function toggleLote(id: string) {
    setSelectedLoteIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (selectedLoteIds.length === 0) return;
    mutation.mutate({ lote_ids: selectedLoteIds, serie: serie || null, numero: numero || null });
  }

  return (
    <Modal title="Nova fatura" isOpen={isOpen} onClose={resetAndClose}>
      <form onSubmit={handleSubmit}>
        <p className="mb-4 text-xs text-ink-faint">
          Junta um ou mais lotes já FECHADOS do MESMO convênio — equivale a "Gera Arquivo - TISS"/"Faturamento
          Emitido" de um ERP real.
        </p>
        <SelectField
          label="Convênio"
          required
          value={insurancePlanId}
          onChange={(e) => {
            setInsurancePlanId(e.target.value);
            setSelectedLoteIds([]);
          }}
        >
          <option value="">Selecione...</option>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.display_name}
            </option>
          ))}
        </SelectField>

        {insurancePlanId && (
          <div className="mb-4">
            <span className="mb-1.5 block text-xs font-medium text-ink-muted">Lotes fechados deste convênio</span>
            {eligibleLotes.length === 0 && (
              <p className="text-xs text-ink-faint">Nenhum lote fechado deste convênio ainda sem fatura.</p>
            )}
            {eligibleLotes.length > 0 && (
              <ul className="max-h-56 divide-y divide-border-subtle overflow-y-auto rounded-md border border-border-hairline">
                {eligibleLotes.map((l) => (
                  <li key={l.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <label className="flex items-center gap-2 text-ink-muted">
                      <input
                        type="checkbox"
                        checked={selectedLoteIds.includes(l.id)}
                        onChange={() => toggleLote(l.id)}
                        className="accent-[hsl(var(--accent))]"
                      />
                      Lote de {formatDate(l.created_at)} ({l.guias_count} guia{l.guias_count === 1 ? "" : "s"})
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <TextField label="Série (opcional)" value={serie} onChange={(e) => setSerie(e.target.value)} />
          <TextField label="Número (opcional)" value={numero} onChange={(e) => setNumero(e.target.value)} />
        </div>

        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={resetAndClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={mutation.isPending || selectedLoteIds.length === 0}>
            {mutation.isPending ? "Gerando..." : "Gerar fatura"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------
// Baixa de fatura
// ---------------------------------------------------------------------

function SettleFaturaModal({ fatura, planName, onClose }: { fatura: Fatura | null; planName: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [valorRecebido, setValorRecebido] = useState("");
  const [isPartial, setIsPartial] = useState(false);

  const mutation = useMutation({
    mutationFn: (payload: FaturaSettleRequest) => apiClient.post<Fatura>(`/api/v1/faturas/${fatura!.id}/baixar`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["faturas"] });
      showSuccess("Baixa registrada.");
      resetAndClose();
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  function resetAndClose() {
    setValorRecebido("");
    setIsPartial(false);
    onClose();
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = Number(valorRecebido.replace(",", "."));
    if (!parsed || parsed <= 0) return;
    mutation.mutate({ valor_recebido: parsed, is_partial: isPartial });
  }

  if (!fatura) return null;

  return (
    <Modal title={`Baixa da fatura — ${planName}`} isOpen={Boolean(fatura)} onClose={resetAndClose}>
      <form onSubmit={handleSubmit}>
        <p className="mb-4 text-xs text-ink-faint">Registre quanto a operadora efetivamente pagou por esta fatura.</p>
        <TextField
          label="Valor recebido (R$)"
          required
          inputMode="decimal"
          value={valorRecebido}
          onChange={(e) => setValorRecebido(e.target.value)}
        />
        <label className="mb-4 flex items-center gap-2 text-xs text-ink-muted">
          <input
            type="checkbox"
            checked={isPartial}
            onChange={(e) => setIsPartial(e.target.checked)}
            className="accent-[hsl(var(--accent))]"
          />
          Pagamento parcial (glosa parcial — a operadora pagou menos do que a fatura pedia)
        </label>
        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={resetAndClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={mutation.isPending || !valorRecebido}>
            {mutation.isPending ? "Registrando..." : "Registrar baixa"}
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
 * Fase 2 do plano de adequação ao fluxo real de mercado (Agendamento ->
 * Atendimento -> Faturamento) — GET/POST /faturas e POST /faturas/{id}/
 * baixar já existiam prontos desde essa fase (FaturaService), mas
 * nenhuma tela os consumia: o fluxo Lote -> Fatura -> Baixa ficava
 * estruturalmente incompleto sem esta página (mesma lacuna que
 * LotesPage.tsx fechou para /lotes).
 */
export function FaturasPage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [settlingFaturaId, setSettlingFaturaId] = useState<string | null>(null);
  const [faturasOffset, setFaturasOffset] = useState(0);

  const activePlansQuery = useQuery({
    queryKey: ["insurance-plans"],
    queryFn: () => apiClient.get<InsurancePlan[]>("/api/v1/insurance-companies/plans"),
  });
  const allPlansQuery = useQuery({
    queryKey: ["insurance-plans", "all"],
    queryFn: () => apiClient.get<InsurancePlan[]>("/api/v1/insurance-companies/plans?include_inactive=true"),
  });
  const planNameById = new Map((allPlansQuery.data ?? []).map((p) => [p.id, p.display_name]));

  // Candidatos a uma fatura nova — lotes já FECHADOS (a validação de
  // "mesmo convênio" acontece no modal, filtrando por insurance_plan_id).
  const closedLotesQuery = useQuery({
    queryKey: ["lotes", "fechado", "para-fatura"],
    queryFn: () => apiClient.get<PaginatedResponse<Lote>>("/api/v1/lotes?status=fechado&limit=200&offset=0"),
    enabled: isCreateModalOpen,
  });

  const {
    data: faturasPage,
    isLoading,
    error,
    refetch: refetchFaturas,
  } = useQuery({
    queryKey: ["faturas", faturasOffset],
    queryFn: () => apiClient.get<PaginatedResponse<Fatura>>(`/api/v1/faturas?limit=${FATURAS_PAGE_SIZE}&offset=${faturasOffset}`),
  });
  const faturas = faturasPage?.items ?? [];
  const settlingFatura = faturas.find((f) => f.id === settlingFaturaId) ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={FileStack}
        title="Faturas"
        subtitle="Gere a fatura a partir de lotes fechados do mesmo convênio e registre a baixa (quanto a operadora efetivamente pagou)."
        action={
          <Button onClick={() => setIsCreateModalOpen(true)} className="flex items-center gap-1.5">
            <Receipt size={14} />
            Nova fatura
          </Button>
        }
      />

      <Panel>
        {isLoading && <LoadingState variant="table" rows={4} />}
        {error && <ErrorState message={getApiErrorMessage(error)} onRetry={() => refetchFaturas()} />}
        {!isLoading && !error && faturas.length === 0 && (
          <EmptyState icon={<FileStack size={17} strokeWidth={1.5} />} message="Nenhuma fatura gerada ainda." />
        )}
        {!isLoading && faturas.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border-hairline text-2xs uppercase tracking-wide text-ink-faint">
                <th className="px-4 py-2.5 font-medium">Convênio</th>
                <th className="px-4 py-2.5 font-medium">Série/Número</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Emitida em</th>
                <th className="px-4 py-2.5 font-medium text-right">Valor recebido</th>
                <th className="px-4 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {faturas.map((f) => (
                <tr key={f.id} className="border-b border-border-hairline last:border-0 transition-colors hover:bg-canvas-raised/60">
                  <td className="px-4 py-2.5 text-ink">{planNameById.get(f.insurance_plan_id) ?? "—"}</td>
                  <td className="px-4 py-2.5 text-ink-muted">
                    {f.serie || f.numero ? `${f.serie ?? "—"} / ${f.numero ?? "—"}` : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge tone={STATUS_TONE[f.status]}>{STATUS_LABELS[f.status]}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-ink-muted">{formatDate(f.data_emissao)}</td>
                  <td className="tabular px-4 py-2.5 text-right text-ink-muted">{formatCurrency(f.valor_recebido)}</td>
                  <td className="px-4 py-2.5 text-right">
                    {f.status === "emitida" && (
                      <Button variant="ghost" size="xs" onClick={() => setSettlingFaturaId(f.id)}>
                        Baixar
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {faturasPage && faturasPage.total > 0 && (
          <Pagination total={faturasPage.total} limit={FATURAS_PAGE_SIZE} offset={faturasOffset} onOffsetChange={setFaturasOffset} />
        )}
      </Panel>

      <CreateFaturaModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        plans={activePlansQuery.data ?? []}
        closedLotes={closedLotesQuery.data?.items ?? []}
      />
      <SettleFaturaModal
        fatura={settlingFatura}
        planName={settlingFatura ? planNameById.get(settlingFatura.insurance_plan_id) ?? "—" : ""}
        onClose={() => setSettlingFaturaId(null)}
      />
    </div>
  );
}
