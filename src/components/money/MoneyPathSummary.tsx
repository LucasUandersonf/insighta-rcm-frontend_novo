import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { brl } from "@/components/money/PreSubmissionIssues";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/context/AuthContext";
import type { CashForecast, PreSubmissionOverview, RecoveryCenter } from "@/lib/types";

/**
 * DECISÃO — o caminho do dinheiro (Caixa 13 semanas, Central de Recuperação
 * e Conferência antes do envio) aparece nos dois polos, o Início e a Sala,
 * em vez de só em Módulos. Mesmas query keys das telas completas: um número
 * aqui e o da tela são sempre o mesmo cache. Some sem permissão (403) ou
 * sem dado, como a linha do Extrato.
 */
const CAN_VIEW = ["owner", "admin", "financeiro", "auditor"];
const STALE_MS = 5 * 60 * 1000;

function useCanView(): boolean {
  const { user } = useAuth();
  return !!user && CAN_VIEW.includes(user.role);
}

export function useCashForecast(enabled = true) {
  return useQuery({
    queryKey: ["financeiro", "caixa-13-semanas"],
    queryFn: () => apiClient.get<CashForecast>("/api/v1/financeiro/caixa-13-semanas"),
    enabled,
    retry: false,
    staleTime: STALE_MS,
  });
}

export function useRecoveryCenter(enabled = true) {
  return useQuery({
    queryKey: ["financeiro", "recuperacao"],
    queryFn: () => apiClient.get<RecoveryCenter>("/api/v1/financeiro/recuperacao"),
    enabled,
    retry: false,
    staleTime: STALE_MS,
  });
}

function usePreSubmission(enabled = true) {
  return useQuery({
    queryKey: ["financeiro", "conferencia-envio"],
    queryFn: () => apiClient.get<PreSubmissionOverview>("/api/v1/financeiro/conferencia-envio"),
    enabled,
    retry: false,
    staleTime: STALE_MS,
  });
}

function PanoramaLine({ label, value, tone, children }: { label: string; value: string; tone?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 border-b border-border-hairline py-3.5">
      <div className="flex items-baseline gap-2.5">
        <span className="text-[13px] text-ink-muted">{label}</span>
        <span className={`tabular ml-auto text-xl font-semibold tracking-[-0.01em] ${tone ?? "text-ink"}`}>{value}</span>
      </div>
      {children}
    </div>
  );
}

/** Duas linhas do Panorama do Início: o que deve entrar e o que dá para recuperar. */
export function MoneyPathPanoramaRows() {
  const canView = useCanView();
  const { data: cash } = useCashForecast(canView);
  const { data: recovery } = useRecoveryCenter(canView);
  if (!canView) return null;
  const overdue = cash ? cash.overdue_submitted + cash.overdue_unsent : 0;
  return (
    <>
      {cash && cash.open_gross > 0 && (
        <PanoramaLine label="Deve entrar em 13 semanas" value={brl(cash.expected_net)}>
          <Link to="/caixa" className="text-[13px] leading-[1.45] text-accent-muted hover:underline">
            {overdue > 0 ? `${brl(overdue)} já passaram do prazo · ` : ""}Ver semana a semana →
          </Link>
        </PanoramaLine>
      )}
      {recovery && recovery.recoverable > 0 && (
        <PanoramaLine label="Dá para recuperar" value={brl(recovery.recoverable)} tone="text-revenue">
          <Link to="/recuperacao" className="text-[13px] leading-[1.45] text-accent-muted hover:underline">
            {recovery.due_7_days > 0 ? `${brl(recovery.due_7_days)} com prazo de recurso acabando em 7 dias · ` : ""}Ver a Central →
          </Link>
        </PanoramaLine>
      )}
    </>
  );
}

function MoneyCard({ to, label, value, tone, note }: { to: string; label: string; value: string; tone: string; note: string }) {
  return (
    <Link
      to={to}
      className="flex flex-col gap-1 rounded-lg border border-border-hairline bg-glass px-4 py-3 transition-colors hover:border-accent/40"
    >
      <span className="text-xs text-ink-faint">{label}</span>
      <span className={`text-lg font-semibold tabular ${tone}`}>{value}</span>
      <span className="text-2xs text-ink-muted">{note}</span>
    </Link>
  );
}

/** Bloco da aba Faturamento da Sala: os três números do caminho do dinheiro. */
export function MoneyPathBlock() {
  const canView = useCanView();
  const { data: cash } = useCashForecast(canView);
  const { data: recovery } = useRecoveryCenter(canView);
  const { data: check } = usePreSubmission(canView);
  if (!canView || (!cash && !recovery && !check)) return null;
  return (
    <section aria-labelledby="caminho-do-dinheiro">
      <h2 id="caminho-do-dinheiro" className="mb-3 text-sm font-medium text-ink">
        Caminho do dinheiro
      </h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {cash && (
          <MoneyCard
            to="/caixa"
            label="Deve entrar em 13 semanas"
            value={brl(cash.expected_net)}
            tone="text-ink"
            note={
              cash.overdue_submitted + cash.overdue_unsent > 0
                ? `${brl(cash.overdue_submitted + cash.overdue_unsent)} já passaram do prazo`
                : "Nada atrasado"
            }
          />
        )}
        {recovery && (
          <MoneyCard
            to="/recuperacao"
            label="Dá para recuperar"
            value={brl(recovery.recoverable)}
            tone="text-revenue"
            note={recovery.due_7_days > 0 ? `${brl(recovery.due_7_days)} com prazo acabando em 7 dias` : "Nenhum prazo vencendo esta semana"}
          />
        )}
        {check && (
          <MoneyCard
            to="/conferencia-envio"
            label="Com problema no próximo envio"
            value={brl(check.blocking_value)}
            tone={check.blocking_value > 0 ? "text-denied" : "text-ink"}
            note={
              check.review_groups > 0
                ? `${check.review_groups} ${check.review_groups === 1 ? "lote para revisar" : "lotes para revisar"} antes de enviar`
                : "Tudo pronto para enviar"
            }
          />
        )}
      </div>
    </section>
  );
}
