import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Receipt, Trash2 } from "lucide-react";
import { Panel, EmptyState, LoadingState, ErrorState } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { TextField, SelectField } from "@/components/ui/FormField";
import { Pagination } from "@/components/ui/Pagination";
import { PageHeader } from "@/components/ui/PageHeader";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { useToast } from "@/context/ToastContext";
import type { CostEntry, CostEntryCategory, CostEntryCreateRequest, PaginatedResponse, Professional } from "@/lib/types";

const COST_ENTRIES_PAGE_SIZE = 20;

const CATEGORY_LABELS: Record<CostEntryCategory, string> = {
  folha_fixa: "Folha fixa",
  comissao_repasse: "Comissão/repasse",
  aluguel: "Aluguel",
  insumo: "Insumo",
  outros: "Outros",
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatMonth(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(`${iso}T00:00:00`));
}

function CreateCostEntryModal({ isOpen, onClose, professionals }: { isOpen: boolean; onClose: () => void; professionals: Professional[] }) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [category, setCategory] = useState<CostEntryCategory>("folha_fixa");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [periodMonth, setPeriodMonth] = useState(() => new Date().toISOString().slice(0, 7) + "-01");
  const [professionalId, setProfessionalId] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: (payload: CostEntryCreateRequest) => apiClient.post<CostEntry>("/api/v1/cost-entries", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cost-entries"] });
      queryClient.invalidateQueries({ queryKey: ["analytics", "profitability"] });
      showSuccess("Custo lançado.");
      resetAndClose();
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  function resetAndClose() {
    setCategory("folha_fixa");
    setDescription("");
    setAmount("");
    setProfessionalId("");
    setFieldErrors({});
    onClose();
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const parsedAmount = Number(amount.replace(",", "."));
    if (!parsedAmount || parsedAmount <= 0) {
      setFieldErrors({ amount: "Informe um valor maior que zero." });
      return;
    }
    mutation.mutate({
      category,
      description: description || null,
      amount: parsedAmount,
      period_month: periodMonth,
      professional_id: professionalId || null,
    });
  }

  return (
    <Modal title="Lançar custo" isOpen={isOpen} onClose={resetAndClose}>
      <form onSubmit={handleSubmit}>
        <p className="mb-4 text-xs text-ink-faint">
          Valor real pago no mês, não uma fórmula automática. Sem profissional selecionado, o custo é GERAL —
          rateado proporcionalmente à receita de cada profissional no cálculo de margem.
        </p>
        <SelectField label="Categoria" required value={category} onChange={(e) => setCategory(e.target.value as CostEntryCategory)}>
          {(Object.keys(CATEGORY_LABELS) as CostEntryCategory[]).map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </SelectField>
        <TextField label="Descrição (opcional)" value={description} onChange={(e) => setDescription(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Valor (R$)"
            required
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            error={fieldErrors["amount"]}
          />
          <TextField
            label="Mês"
            type="month"
            required
            value={periodMonth.slice(0, 7)}
            onChange={(e) => setPeriodMonth(`${e.target.value}-01`)}
          />
        </div>
        <SelectField
          label="Profissional (opcional — deixe em branco pra custo geral)"
          value={professionalId}
          onChange={(e) => setProfessionalId(e.target.value)}
        >
          <option value="">Custo geral da clínica</option>
          {professionals.map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name}
            </option>
          ))}
        </SelectField>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={resetAndClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Salvando..." : "Lançar custo"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Épico F3.1 do Plano Diretor ("Módulo de custos e margem real") — "É
 * o gap mais sério do produto inteiro." Tela de lançamento manual de
 * custo mensal (folha, repasse, aluguel, insumo) que alimenta a margem
 * líquida em ProfitabilityPanel.tsx (aba Rentabilidade da Sala de
 * Comando) — ver DECISÃO completa em app/sql/039_cost_entries.sql no
 * backend sobre por que é lançamento manual, não uma fórmula
 * automática de comissão.
 */
export function CostEntriesPage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<CostEntry | null>(null);
  const [entriesOffset, setEntriesOffset] = useState(0);
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();

  const { data: professionals } = useQuery({
    queryKey: ["professionals"],
    queryFn: () => apiClient.get<Professional[]>("/api/v1/professionals"),
  });
  const professionalNameById = new Map((professionals ?? []).map((p) => [p.id, p.full_name]));

  const {
    data: entriesPage,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["cost-entries", entriesOffset],
    queryFn: () =>
      apiClient.get<PaginatedResponse<CostEntry>>(`/api/v1/cost-entries?limit=${COST_ENTRIES_PAGE_SIZE}&offset=${entriesOffset}`),
  });
  const entries = entriesPage?.items ?? [];

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/v1/cost-entries/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cost-entries"] });
      queryClient.invalidateQueries({ queryKey: ["analytics", "profitability"] });
      showSuccess("Lançamento removido.");
      setEntryToDelete(null);
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Receipt}
        title="Custos"
        subtitle="Folha, repasse, aluguel e insumo — mês a mês, alimenta a margem líquida na aba Rentabilidade da Sala de Comando."
        action={
          <Button onClick={() => setIsCreateModalOpen(true)} className="flex items-center gap-1.5">
            <Plus size={14} />
            Lançar custo
          </Button>
        }
      />

      <Panel>
        {isLoading && <LoadingState variant="table" rows={4} />}
        {error && <ErrorState message={getApiErrorMessage(error)} onRetry={() => refetch()} />}
        {!isLoading && !error && entries.length === 0 && (
          <EmptyState icon={<Receipt size={17} strokeWidth={1.5} />} message="Nenhum custo lançado ainda." />
        )}
        {!isLoading && entries.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border-hairline text-2xs uppercase tracking-wide text-ink-faint">
                <th className="px-4 py-2.5 font-medium">Mês</th>
                <th className="px-4 py-2.5 font-medium">Categoria</th>
                <th className="px-4 py-2.5 font-medium">Descrição</th>
                <th className="px-4 py-2.5 font-medium">Profissional</th>
                <th className="px-4 py-2.5 font-medium text-right">Valor</th>
                <th className="px-4 py-2.5 font-medium"><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-border-hairline last:border-0 transition-colors hover:bg-canvas-raised/60">
                  <td className="px-4 py-2.5 text-ink-muted capitalize">{formatMonth(e.period_month)}</td>
                  <td className="px-4 py-2.5 text-ink">{CATEGORY_LABELS[e.category]}</td>
                  <td className="px-4 py-2.5 text-ink-muted">{e.description ?? "—"}</td>
                  <td className="px-4 py-2.5 text-ink-muted">
                    {e.professional_id ? professionalNameById.get(e.professional_id) ?? "—" : "Geral"}
                  </td>
                  <td className="tabular px-4 py-2.5 text-right text-ink">{formatCurrency(e.amount)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Button
                      variant="ghost"
                      size="xs"
                      className="flex items-center gap-1 text-denied"
                      onClick={() => setEntryToDelete(e)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 size={12} />
                      Remover
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {entriesPage && entriesPage.total > 0 && (
          <Pagination
            total={entriesPage.total}
            limit={COST_ENTRIES_PAGE_SIZE}
            offset={entriesOffset}
            onOffsetChange={setEntriesOffset}
            label="Paginação de lançamentos de custo"
          />
        )}
      </Panel>

      <CreateCostEntryModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} professionals={professionals ?? []} />

      <ConfirmDialog
        isOpen={!!entryToDelete}
        title="Remover lançamento de custo"
        message={
          entryToDelete
            ? `O lançamento de ${CATEGORY_LABELS[entryToDelete.category]} (${formatCurrency(entryToDelete.amount)}, ${formatMonth(entryToDelete.period_month)}) será removido e não pode ser desfeito.`
            : ""
        }
        onConfirm={() => entryToDelete && deleteMutation.mutate(entryToDelete.id)}
        onCancel={() => setEntryToDelete(null)}
        isConfirming={deleteMutation.isPending}
      />
    </div>
  );
}
