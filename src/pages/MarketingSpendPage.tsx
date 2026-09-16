import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Megaphone, Plus, Trash2 } from "lucide-react";
import { Panel, EmptyState, LoadingState, ErrorState } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TextField, SelectField } from "@/components/ui/FormField";
import { Pagination } from "@/components/ui/Pagination";
import { PageHeader } from "@/components/ui/PageHeader";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { useToast } from "@/context/ToastContext";
import type { MarketingSpend, MarketingSpendCreateRequest, MarketingSpendSource, PaginatedResponse } from "@/lib/types";

const MARKETING_SPEND_PAGE_SIZE = 20;

const SOURCE_LABELS: Record<MarketingSpendSource, string> = {
  meta_ads: "Meta Ads (Facebook/Instagram)",
  google_ads: "Google Ads",
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${iso}T00:00:00`));
}

function CreateMarketingSpendModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [source, setSource] = useState<MarketingSpendSource>("meta_ads");
  const [campaignId, setCampaignId] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [amountSpent, setAmountSpent] = useState("");
  const [spendDate, setSpendDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: (payload: MarketingSpendCreateRequest) => apiClient.post<MarketingSpend>("/api/v1/marketing-spend", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing-spend"] });
      queryClient.invalidateQueries({ queryKey: ["analytics", "marketing-channels"] });
      queryClient.invalidateQueries({ queryKey: ["analytics", "smart-insights"] });
      showSuccess("Gasto de marketing lançado.");
      resetAndClose();
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  function resetAndClose() {
    setSource("meta_ads");
    setCampaignId("");
    setCampaignName("");
    setAmountSpent("");
    setFieldErrors({});
    onClose();
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const parsedAmount = Number(amountSpent.replace(",", "."));
    if (!parsedAmount || parsedAmount <= 0) {
      setFieldErrors({ amount_spent: "Informe um valor maior que zero." });
      return;
    }
    if (!campaignId.trim()) {
      setFieldErrors({ campaign_id: "Informe o identificador da campanha." });
      return;
    }
    mutation.mutate({
      source,
      campaign_id: campaignId.trim(),
      campaign_name: campaignName || null,
      amount_spent: parsedAmount,
      spend_date: spendDate,
    });
  }

  return (
    <Modal title="Lançar gasto de marketing" isOpen={isOpen} onClose={resetAndClose}>
      <form onSubmit={handleSubmit}>
        <p className="mb-4 text-xs text-ink-faint">
          Valor real gasto no dia, por campanha — sem isso, CAC/ROI de marketing sempre mostra a receita adquirida
          sem nunca mostrar o custo real.
        </p>
        <SelectField label="Canal" required value={source} onChange={(e) => setSource(e.target.value as MarketingSpendSource)}>
          {(Object.keys(SOURCE_LABELS) as MarketingSpendSource[]).map((s) => (
            <option key={s} value={s}>
              {SOURCE_LABELS[s]}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Identificador da campanha"
          required
          value={campaignId}
          onChange={(e) => setCampaignId(e.target.value)}
          error={fieldErrors["campaign_id"]}
        />
        <TextField label="Nome da campanha (opcional)" value={campaignName} onChange={(e) => setCampaignName(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Valor gasto (R$)"
            required
            inputMode="decimal"
            value={amountSpent}
            onChange={(e) => setAmountSpent(e.target.value)}
            error={fieldErrors["amount_spent"]}
          />
          <TextField label="Data" type="date" required value={spendDate} onChange={(e) => setSpendDate(e.target.value)} />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={resetAndClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Salvando..." : "Lançar gasto"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Achado do Dossiê Insighta RCM — Onda 2 do Plano de Ação ("ROI de
 * marketing é pior que 'não lido': nunca escrito"). As queries de
 * leitura (ver MarketingChannelsPanel.tsx, GET /analytics/marketing-
 * channels) já existiam e funcionavam; core.marketing_spend nunca
 * recebia uma linha. Tela de lançamento manual (mesmo espírito de
 * CostEntriesPage.tsx, F3.1) — Etapa 1 de 2 do plano: entrada manual
 * agora, integração automática com a API do Meta/Google Ads depois, só
 * se a Etapa 1 provar que o gestor de fato usa o número.
 */
export function MarketingSpendPage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [entriesOffset, setEntriesOffset] = useState(0);
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();

  const {
    data: entriesPage,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["marketing-spend", entriesOffset],
    queryFn: () =>
      apiClient.get<PaginatedResponse<MarketingSpend>>(
        `/api/v1/marketing-spend?limit=${MARKETING_SPEND_PAGE_SIZE}&offset=${entriesOffset}`
      ),
  });
  const entries = entriesPage?.items ?? [];

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/v1/marketing-spend/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing-spend"] });
      queryClient.invalidateQueries({ queryKey: ["analytics", "marketing-channels"] });
      showSuccess("Lançamento removido.");
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Megaphone}
        title="Gasto de marketing"
        subtitle="Gasto real por campanha, dia a dia — alimenta CAC e ROI de marketing na aba Rentabilidade da Sala de Comando."
        action={
          <Button onClick={() => setIsCreateModalOpen(true)} className="flex items-center gap-1.5">
            <Plus size={14} />
            Lançar gasto
          </Button>
        }
      />

      <Panel>
        {isLoading && <LoadingState variant="table" rows={4} />}
        {error && <ErrorState message={getApiErrorMessage(error)} onRetry={() => refetch()} />}
        {!isLoading && !error && entries.length === 0 && (
          <EmptyState icon={<Megaphone size={17} strokeWidth={1.5} />} message="Nenhum gasto de marketing lançado ainda." />
        )}
        {!isLoading && entries.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border-hairline text-2xs uppercase tracking-wide text-ink-faint">
                <th className="px-4 py-2.5 font-medium">Data</th>
                <th className="px-4 py-2.5 font-medium">Canal</th>
                <th className="px-4 py-2.5 font-medium">Campanha</th>
                <th className="px-4 py-2.5 font-medium text-right">Gasto</th>
                <th className="px-4 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-border-hairline last:border-0 transition-colors hover:bg-canvas-raised/60">
                  <td className="px-4 py-2.5 text-ink-muted">{formatDate(e.spend_date)}</td>
                  <td className="px-4 py-2.5 text-ink">{SOURCE_LABELS[e.source]}</td>
                  <td className="px-4 py-2.5 text-ink-muted">{e.campaign_name ?? e.campaign_id}</td>
                  <td className="tabular px-4 py-2.5 text-right text-ink">{formatCurrency(e.amount_spent)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Button
                      variant="ghost"
                      size="xs"
                      className="flex items-center gap-1 text-denied"
                      onClick={() => deleteMutation.mutate(e.id)}
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
            limit={MARKETING_SPEND_PAGE_SIZE}
            offset={entriesOffset}
            onOffsetChange={setEntriesOffset}
          />
        )}
      </Panel>

      <CreateMarketingSpendModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
    </div>
  );
}
