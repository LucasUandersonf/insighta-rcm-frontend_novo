import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileWarning, Plus } from "lucide-react";
import { Panel, EmptyState, LoadingState, ErrorState } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TextField } from "@/components/ui/FormField";
import { Pagination } from "@/components/ui/Pagination";
import { PageHeader } from "@/components/ui/PageHeader";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { PeriodWindowSelect } from "@/components/ui/PeriodWindowSelect";
import { BillingSearchPicker } from "@/components/billing/BillingSearchPicker";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { useDateWindow } from "@/lib/useDateWindow";
import { useToast } from "@/context/ToastContext";
import type { BillingSearchItem, Glosa, GlosaCreateRequest, GlosaReconciliationResponse, PaginatedResponse } from "@/lib/types";

const GLOSAS_PAGE_SIZE = 20;

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatPct(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(1)}%`;
}

// ---------------------------------------------------------------------
// Registrar glosa real
// ---------------------------------------------------------------------

function CreateGlosaModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [billing, setBilling] = useState<BillingSearchItem | null>(null);
  const [codigoMotivo, setCodigoMotivo] = useState("");
  const [descricaoMotivo, setDescricaoMotivo] = useState("");
  const [valorGlosado, setValorGlosado] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: (payload: GlosaCreateRequest) => apiClient.post<Glosa>("/api/v1/glosas", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["glosas"] });
      queryClient.invalidateQueries({ queryKey: ["glosas", "reconciliacao"] });
      showSuccess("Glosa registrada.");
      resetAndClose();
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  function resetAndClose() {
    setBilling(null);
    setCodigoMotivo("");
    setDescricaoMotivo("");
    setValorGlosado("");
    setFieldErrors({});
    onClose();
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!billing) {
      setFieldErrors({ billing: "Selecione o faturamento glosado." });
      return;
    }
    const parsedValue = Number(valorGlosado.replace(",", "."));
    if (!parsedValue || parsedValue <= 0) {
      setFieldErrors({ valor: "Informe um valor maior que zero." });
      return;
    }
    mutation.mutate({
      billing_id: billing.id,
      codigo_motivo: codigoMotivo || null,
      descricao_motivo: descricaoMotivo || null,
      valor_glosado: parsedValue,
    });
  }

  return (
    <Modal title="Registrar glosa" isOpen={isOpen} onClose={resetAndClose}>
      <form onSubmit={handleSubmit}>
        <p className="mb-4 text-xs text-ink-faint">
          Registra o FATO de uma glosa real recebida da operadora — diferente do risco PREVISTO (que já aparece na
          tela de faturamento). Não abre um recurso automaticamente, isso continua sendo decisão do time.
        </p>
        <BillingSearchPicker selected={billing} onSelect={setBilling} error={fieldErrors["billing"]} />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Código do motivo (opcional)" value={codigoMotivo} onChange={(e) => setCodigoMotivo(e.target.value)} />
          <TextField
            label="Valor glosado (R$)"
            required
            inputMode="decimal"
            value={valorGlosado}
            onChange={(e) => setValorGlosado(e.target.value)}
            error={fieldErrors["valor"]}
          />
        </div>
        <TextField
          label="Descrição do motivo (opcional)"
          value={descricaoMotivo}
          onChange={(e) => setDescricaoMotivo(e.target.value)}
          placeholder="Ex.: Falta de CID na guia"
        />
        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={resetAndClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Registrando..." : "Registrar glosa"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------
// Reconciliação — Previsto (denial_risk_engine.py) x Realizado
// ---------------------------------------------------------------------

function ReconciliationPanel() {
  const { windowDays, setWindowDays, dateFrom, dateTo } = useDateWindow(7);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["glosas", "reconciliacao", dateFrom, dateTo],
    queryFn: () =>
      apiClient.get<GlosaReconciliationResponse>(`/api/v1/glosas/reconciliacao?date_from=${dateFrom}&date_to=${dateTo}`),
  });

  return (
    <Panel>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-ink">Previsto x Realizado</h2>
          <p className="mt-0.5 text-xs text-ink-faint">
            Prova se o motor de risco de glosa acerta na prática — não só "parece funcionar".
          </p>
        </div>
        <PeriodWindowSelect windowDays={windowDays} onChange={setWindowDays} />
      </div>

      {isLoading && <LoadingState variant="table" rows={3} />}
      {error && <ErrorState message={getApiErrorMessage(error)} onRetry={() => refetch()} />}

      {data && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-md border border-border-hairline bg-canvas-raised px-3 py-2.5">
              <p className="text-2xs uppercase tracking-wide text-ink-faint">Precisão</p>
              <p className="tabular text-lg text-ink">{formatPct(data.precision_pct)}</p>
              <p className="text-2xs text-ink-faint">dos previstos, quantos glosaram de fato</p>
            </div>
            <div className="rounded-md border border-border-hairline bg-canvas-raised px-3 py-2.5">
              <p className="text-2xs uppercase tracking-wide text-ink-faint">Sensibilidade</p>
              <p className="tabular text-lg text-ink">{formatPct(data.recall_pct)}</p>
              <p className="text-2xs text-ink-faint">das glosas reais, quantas o motor previu</p>
            </div>
            <div className="rounded-md border border-border-hairline bg-canvas-raised px-3 py-2.5">
              <p className="text-2xs uppercase tracking-wide text-ink-faint">R$ glosado previsto</p>
              <p className="tabular text-lg text-ink">{formatCurrency(data.valor_glosado_previsto)}</p>
            </div>
            <div className="rounded-md border border-border-hairline bg-canvas-raised px-3 py-2.5">
              <p className="text-2xs uppercase tracking-wide text-ink-faint">R$ glosado sem previsão</p>
              <p className="tabular text-lg text-ink">{formatCurrency(data.valor_glosado_nao_previsto)}</p>
              <p className="text-2xs text-ink-faint">ponto cego do motor — ninguém revisou antes de enviar</p>
            </div>
          </div>

          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border-hairline text-2xs uppercase tracking-wide text-ink-faint">
                <th className="px-4 py-2.5 font-medium">Risco previsto</th>
                <th className="px-4 py-2.5 font-medium text-right">Faturamentos</th>
                <th className="px-4 py-2.5 font-medium text-right">Glosados</th>
                <th className="px-4 py-2.5 font-medium text-right">R$ glosado</th>
              </tr>
            </thead>
            <tbody>
              {data.by_risk_level.map((row) => (
                <tr key={row.level} className="border-b border-border-hairline last:border-0">
                  <td className="px-4 py-2.5">
                    <RiskBadge level={row.level as "low" | "medium" | "high"} />
                  </td>
                  <td className="tabular px-4 py-2.5 text-right text-ink-muted">{row.billing_count}</td>
                  <td className="tabular px-4 py-2.5 text-right text-ink-muted">{row.glosado_count}</td>
                  <td className="tabular px-4 py-2.5 text-right text-ink-muted">{formatCurrency(row.valor_glosado_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------

/**
 * Fase 3 do plano de adequação ao fluxo real de mercado (Agendamento ->
 * Atendimento -> Faturamento) — POST/GET /glosas e GET /glosas/
 * reconciliacao já existiam prontos desde essa fase (GlosaService), mas
 * nenhuma tela os consumia: sem esta página, "registrar a glosa real" e
 * a prova de precisão do motor de risco (Previsto x Realizado) ficavam
 * inacessíveis para o usuário final.
 */
export function GlosasPage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [glosasOffset, setGlosasOffset] = useState(0);

  const {
    data: glosasPage,
    isLoading,
    error,
    refetch: refetchGlosas,
  } = useQuery({
    queryKey: ["glosas", glosasOffset],
    queryFn: () => apiClient.get<PaginatedResponse<Glosa>>(`/api/v1/glosas?limit=${GLOSAS_PAGE_SIZE}&offset=${glosasOffset}`),
  });
  const glosas = glosasPage?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        icon={FileWarning}
        title="Glosas"
        subtitle="Registre a glosa real recebida da operadora e acompanhe a precisão do motor de risco de glosa."
        action={
          <Button onClick={() => setIsCreateModalOpen(true)} className="flex items-center gap-1.5">
            <Plus size={14} />
            Registrar glosa
          </Button>
        }
      />

      <ReconciliationPanel />

      <Panel>
        {isLoading && <LoadingState variant="table" rows={4} />}
        {error && <ErrorState message={getApiErrorMessage(error)} onRetry={() => refetchGlosas()} />}
        {!isLoading && !error && glosas.length === 0 && (
          <EmptyState icon={<FileWarning size={17} strokeWidth={1.5} />} message="Nenhuma glosa registrada ainda." />
        )}
        {!isLoading && glosas.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border-hairline text-2xs uppercase tracking-wide text-ink-faint">
                <th className="px-4 py-2.5 font-medium">Recebida em</th>
                <th className="px-4 py-2.5 font-medium">Motivo</th>
                <th className="px-4 py-2.5 font-medium text-right">Valor glosado</th>
              </tr>
            </thead>
            <tbody>
              {glosas.map((g) => (
                <tr key={g.id} className="border-b border-border-hairline last:border-0 transition-colors hover:bg-canvas-raised/60">
                  <td className="px-4 py-2.5 text-ink-muted">{formatDate(g.data_recebimento)}</td>
                  <td className="px-4 py-2.5 text-ink">
                    {g.descricao_motivo ?? g.codigo_motivo ?? "—"}
                    {g.codigo_motivo && g.descricao_motivo && (
                      <span className="ml-1.5 text-2xs text-ink-faint">({g.codigo_motivo})</span>
                    )}
                  </td>
                  <td className="tabular px-4 py-2.5 text-right text-ink">{formatCurrency(g.valor_glosado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {glosasPage && glosasPage.total > 0 && (
          <Pagination total={glosasPage.total} limit={GLOSAS_PAGE_SIZE} offset={glosasOffset} onOffsetChange={setGlosasOffset} />
        )}
      </Panel>

      <CreateGlosaModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
    </div>
  );
}
