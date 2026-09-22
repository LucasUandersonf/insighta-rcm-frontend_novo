import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Boxes, Layers, Plus } from "lucide-react";
import { Panel, EmptyState, LoadingState, ErrorState } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SelectField } from "@/components/ui/FormField";
import { Pagination } from "@/components/ui/Pagination";
import { PageHeader } from "@/components/ui/PageHeader";
import { cn } from "@/lib/cn";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { useToast } from "@/context/ToastContext";
import type { Guia, GuiaTipo, InsurancePlan, Lote, LoteCreateRequest, LoteStatus, PaginatedResponse } from "@/lib/types";

const LOTES_PAGE_SIZE = 20;

// Mesmo rótulo já usado no cadastro avulso de Guia em BillingOperationsPage.tsx
// — nunca duplicar com texto diferente, senão a mesma guia "muda de nome"
// dependendo de qual tela o usuário está olhando.
const GUIA_TIPO_LABELS: Record<GuiaTipo, string> = {
  consulta: "Consulta",
  sadt: "SP/SADT",
  resumo_internacao: "Resumo de internação",
  honorario: "Honorário individual",
};

const STATUS_LABELS: Record<LoteStatus, string> = {
  aberto: "Aberto",
  fechado: "Fechado",
  faturado: "Faturado",
};

const STATUS_TONE: Record<LoteStatus, BadgeTone> = {
  aberto: "pending",
  fechado: "neutral",
  faturado: "revenue",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));
}

// ---------------------------------------------------------------------
// Novo lote
// ---------------------------------------------------------------------

function CreateLoteModal({ isOpen, onClose, plans }: { isOpen: boolean; onClose: () => void; plans: InsurancePlan[] }) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [insurancePlanId, setInsurancePlanId] = useState("");
  const [tipo, setTipo] = useState<GuiaTipo>("consulta");

  const mutation = useMutation({
    mutationFn: (payload: LoteCreateRequest) => apiClient.post<Lote>("/api/v1/lotes", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lotes"] });
      showSuccess("Lote criado.");
      resetAndClose();
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  function resetAndClose() {
    setInsurancePlanId("");
    setTipo("consulta");
    onClose();
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!insurancePlanId) return;
    mutation.mutate({ insurance_plan_id: insurancePlanId, tipo });
  }

  return (
    <Modal title="Novo lote de faturamento" isOpen={isOpen} onClose={resetAndClose}>
      <form onSubmit={handleSubmit}>
        <p className="mb-4 text-xs text-ink-faint">
          Um lote agrupa guias do MESMO convênio e do MESMO tipo — só guias compatíveis podem ser atribuídas a ele
          depois (a mesma regra que 3 ERPs de mercado já seguem).
        </p>
        <SelectField label="Convênio" required value={insurancePlanId} onChange={(e) => setInsurancePlanId(e.target.value)}>
          <option value="">Selecione...</option>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.display_name}
            </option>
          ))}
        </SelectField>
        <SelectField label="Tipo" required value={tipo} onChange={(e) => setTipo(e.target.value as GuiaTipo)}>
          {(Object.keys(GUIA_TIPO_LABELS) as GuiaTipo[]).map((t) => (
            <option key={t} value={t}>
              {GUIA_TIPO_LABELS[t]}
            </option>
          ))}
        </SelectField>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={resetAndClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={mutation.isPending || !insurancePlanId}>
            {mutation.isPending ? "Criando..." : "Criar lote"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------
// Detalhe do lote (guias dentro + candidatas + fechar)
// ---------------------------------------------------------------------

function LoteDetailModal({ lote, planName, onClose }: { lote: Lote | null; planName: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const isAberto = lote?.status === "aberto";
  const [guiaToRemove, setGuiaToRemove] = useState<Guia | null>(null);

  const guiasQuery = useQuery({
    queryKey: ["lotes", lote?.id, "guias"],
    queryFn: () => apiClient.get<Guia[]>(`/api/v1/lotes/${lote!.id}/guias`),
    enabled: Boolean(lote),
  });
  // Candidatas (mesmo convênio + tipo, ainda sem lote) só fazem sentido
  // pra um lote aberto — um lote fechado/faturado não aceita mais
  // atribuição (ver LoteService.add_guia no backend).
  const candidatesQuery = useQuery({
    queryKey: ["lotes", lote?.id, "guias-candidatas"],
    queryFn: () => apiClient.get<Guia[]>(`/api/v1/lotes/${lote!.id}/guias-candidatas`),
    enabled: Boolean(lote) && isAberto,
  });

  function invalidateLote() {
    queryClient.invalidateQueries({ queryKey: ["lotes"] });
  }

  const addMutation = useMutation({
    mutationFn: (guiaId: string) => apiClient.post<Guia>(`/api/v1/lotes/${lote!.id}/guias/${guiaId}`),
    onSuccess: () => {
      invalidateLote();
      showSuccess("Guia adicionada ao lote.");
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  const removeMutation = useMutation({
    mutationFn: (guiaId: string) => apiClient.delete<Guia>(`/api/v1/lotes/${lote!.id}/guias/${guiaId}`),
    onSuccess: () => {
      invalidateLote();
      showSuccess("Guia removida do lote.");
      setGuiaToRemove(null);
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  const fecharMutation = useMutation({
    mutationFn: () => apiClient.post<Lote>(`/api/v1/lotes/${lote!.id}/fechar`),
    onSuccess: () => {
      invalidateLote();
      showSuccess("Lote fechado — pronto para virar fatura.");
      onClose();
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  if (!lote) return null;
  const guias = guiasQuery.data ?? [];
  const candidates = candidatesQuery.data ?? [];

  return (
    <Modal title={`Lote — ${planName}`} isOpen={Boolean(lote)} onClose={onClose}>
      <div className="mb-4 flex items-center gap-2">
        <Badge tone={STATUS_TONE[lote.status]}>{STATUS_LABELS[lote.status]}</Badge>
        <span className="text-xs text-ink-faint">{GUIA_TIPO_LABELS[lote.tipo]}</span>
      </div>

      <h3 className="mb-2 text-2xs font-medium uppercase tracking-wide text-ink-faint">Guias no lote ({guias.length})</h3>
      {guiasQuery.isLoading && <LoadingState variant="table" rows={2} />}
      {!guiasQuery.isLoading && guias.length === 0 && (
        <p className="mb-4 text-xs text-ink-faint">Nenhuma guia neste lote ainda.</p>
      )}
      {guias.length > 0 && (
        <ul className="mb-4 divide-y divide-border-subtle">
          {guias.map((g) => (
            <li key={g.id} className="flex items-center justify-between py-2 text-sm">
              <span className="text-ink">
                {g.numero ?? "Sem número"} <span className="text-2xs text-ink-faint">— {formatDate(g.created_at)}</span>
              </span>
              {isAberto && (
                <Button variant="ghost" size="xs" onClick={() => setGuiaToRemove(g)} disabled={removeMutation.isPending}>
                  Remover
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {isAberto && (
        <>
          <h3 className="mb-2 text-2xs font-medium uppercase tracking-wide text-ink-faint">
            Guias disponíveis para atribuir
          </h3>
          {candidatesQuery.isLoading && <LoadingState variant="table" rows={2} />}
          {!candidatesQuery.isLoading && candidates.length === 0 && (
            <p className="mb-4 text-xs text-ink-faint">
              Nenhuma guia do mesmo convênio e tipo disponível fora de um lote.
            </p>
          )}
          {candidates.length > 0 && (
            <ul className="mb-4 divide-y divide-border-subtle">
              {candidates.map((g) => (
                <li key={g.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-ink">{g.numero ?? "Sem número"}</span>
                  <Button variant="secondary" size="xs" onClick={() => addMutation.mutate(g.id)} disabled={addMutation.isPending}>
                    Adicionar
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          Fechar janela
        </Button>
        {isAberto && (
          <Button
            onClick={() => fecharMutation.mutate()}
            disabled={fecharMutation.isPending || guias.length === 0}
            title={guias.length === 0 ? "Um lote sem nenhuma guia não pode ser fechado." : undefined}
          >
            {fecharMutation.isPending ? "Fechando..." : "Fechar lote"}
          </Button>
        )}
      </div>

      <ConfirmDialog
        isOpen={!!guiaToRemove}
        title="Remover guia do lote"
        message={
          guiaToRemove
            ? `A guia ${guiaToRemove.numero ?? "sem número"} volta a ficar disponível para atribuição em outro lote — não some do sistema, só sai deste lote.`
            : ""
        }
        onConfirm={() => guiaToRemove && removeMutation.mutate(guiaToRemove.id)}
        onCancel={() => setGuiaToRemove(null)}
        isConfirming={removeMutation.isPending}
      />
    </Modal>
  );
}

// ---------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------

/**
 * Achado do Parecer Técnico "Boletim Insighta" (revisão 2): o insight
 * "Tem lote de faturamento aberto há muito tempo" (smart_insights_engine.py
 * / _stale_open_lotes_insight) SEMPRE existiu mas nunca tinha uma tela
 * de destino — o botão de ação ficava propositalmente escondido. Esta
 * tela fecha essa lacuna: gestão completa do endpoint /lotes, que antes
 * só era consumido internamente por FaturaService.create_from_lotes.
 */
export function LotesPage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [detailLoteId, setDetailLoteId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<LoteStatus | "">("");
  const [lotesOffset, setLotesOffset] = useState(0);

  // Ativos apenas — alimenta o SELECT de convênio no "Novo lote" (mesmo
  // critério de ContractsPage: não faz sentido abrir lote novo pra um
  // convênio desativado).
  const activePlansQuery = useQuery({
    queryKey: ["insurance-plans"],
    queryFn: () => apiClient.get<InsurancePlan[]>("/api/v1/insurance-companies/plans"),
  });
  // Ativos + inativos — resolve o NOME do convênio na tabela/modal
  // (um lote antigo não deveria "perder" o nome do convênio na tela só
  // porque o convênio foi desativado depois).
  const allPlansQuery = useQuery({
    queryKey: ["insurance-plans", "all"],
    queryFn: () => apiClient.get<InsurancePlan[]>("/api/v1/insurance-companies/plans?include_inactive=true"),
  });
  const planNameById = new Map((allPlansQuery.data ?? []).map((p) => [p.id, p.display_name]));

  const {
    data: lotesPage,
    isLoading,
    error,
    refetch: refetchLotes,
  } = useQuery({
    queryKey: ["lotes", statusFilter, lotesOffset],
    queryFn: () => {
      const params = new URLSearchParams({ limit: String(LOTES_PAGE_SIZE), offset: String(lotesOffset) });
      if (statusFilter) params.set("status", statusFilter);
      return apiClient.get<PaginatedResponse<Lote>>(`/api/v1/lotes?${params.toString()}`);
    },
  });
  const lotes = lotesPage?.items ?? [];
  const detailLote = lotes.find((l) => l.id === detailLoteId) ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Layers}
        title="Lotes de faturamento"
        subtitle="Agrupe guias do mesmo convênio e tipo antes de fechar e gerar a fatura — o mesmo fluxo de 'lote' que um ERP de faturamento médico já usa."
        action={
          <Button onClick={() => setIsCreateModalOpen(true)} className="flex items-center gap-1.5">
            <Plus size={14} />
            Novo lote
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2">
        {(["", "aberto", "fechado", "faturado"] as const).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={statusFilter === s}
            onClick={() => {
              setStatusFilter(s);
              setLotesOffset(0);
            }}
            className={cn(
              "rounded-full border px-3 py-1 text-2xs font-medium transition-colors",
              statusFilter === s
                ? "border-accent/30 bg-accent-bg text-accent"
                : "border-border-subtle text-ink-faint hover:border-border hover:text-ink"
            )}
          >
            {s === "" ? "Todos" : STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      <Panel>
        {isLoading && <LoadingState variant="table" rows={4} />}
        {error && <ErrorState message={getApiErrorMessage(error)} onRetry={() => refetchLotes()} />}
        {!isLoading && !error && lotes.length === 0 && (
          <EmptyState icon={<Boxes size={17} strokeWidth={1.5} />} message="Nenhum lote nesta visão." />
        )}
        {!isLoading && lotes.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border-hairline text-2xs uppercase tracking-wide text-ink-faint">
                <th className="px-4 py-2.5 font-medium">Convênio</th>
                <th className="px-4 py-2.5 font-medium">Tipo</th>
                <th className="px-4 py-2.5 font-medium">Guias</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Aberto em</th>
                <th className="px-4 py-2.5 font-medium"><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {lotes.map((l) => (
                <tr key={l.id} className="border-b border-border-hairline last:border-0 transition-colors hover:bg-canvas-raised/60">
                  <td className="px-4 py-2.5 text-ink">{planNameById.get(l.insurance_plan_id) ?? "—"}</td>
                  <td className="px-4 py-2.5 text-ink-muted">{GUIA_TIPO_LABELS[l.tipo]}</td>
                  <td className="tabular px-4 py-2.5 text-ink-muted">{l.guias_count}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone={STATUS_TONE[l.status]}>{STATUS_LABELS[l.status]}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-ink-muted">{formatDate(l.created_at)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Button variant="ghost" size="xs" onClick={() => setDetailLoteId(l.id)}>
                      Ver guias
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {lotesPage && lotesPage.total > 0 && (
          <Pagination total={lotesPage.total} limit={LOTES_PAGE_SIZE} offset={lotesOffset} onOffsetChange={setLotesOffset} label="Paginação de lotes" />
        )}
      </Panel>

      <CreateLoteModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} plans={activePlansQuery.data ?? []} />
      <LoteDetailModal
        lote={detailLote}
        planName={detailLote ? planNameById.get(detailLote.insurance_plan_id) ?? "—" : ""}
        onClose={() => setDetailLoteId(null)}
      />
    </div>
  );
}
