import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { CommandCenterToday } from "@/components/dashboard/CommandCenterToday";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/context/AuthContext";
import { renderWithProviders } from "@/test/utils";
import type { ExecutiveSummary } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn(), post: vi.fn(), patch: vi.fn() } };
});
vi.mock("@/context/AuthContext", () => ({ useAuth: vi.fn() }));

const kpi = (value: number, delta: number | null) => ({ value, previous_value: value, delta_pct: delta });
const SUMMARY = {
  period_start: "2026-08-25",
  period_end: "2026-09-23",
  total_billed: kpi(482000, 6),
  total_value_saved: kpi(23900, 11),
  financial_hole: kpi(61400, 18),
  payment_gap: kpi(0, null),
  margin_vs_contracted_pct: 87,
  avg_capacity_utilization: kpi(0.87, 0),
  high_risk_pending_count: 2,
  appeals_due_soon_count: 4,
  denial_risk_pct: 12,
  denial_at_risk_value: 9200,
  avg_days_to_receive: kpi(38, -9.5),
} as ExecutiveSummary;

describe("CommandCenterToday (Sala de Comando → Hoje)", () => {
  it("monta indicadores, manchete com as três perguntas, fila e gráfico com anotação", async () => {
    vi.mocked(useAuth).mockReturnValue({ user: { tenant_id: "t1", sub: "u1", role: "owner" } } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url.includes("smart-insights"))
        return Promise.resolve({
          period_start: "",
          period_end: "",
          insights: [
            {
              severity: "critical",
              category: "faturamento",
              title: "A Unimed está recusando mais pagamentos que o normal",
              message: "Glosa de 6% para 14%.",
              financial_impact: 28900,
              action_label: "Ver faturamentos de alto risco da Unimed",
              action_href: "/painel",
              detected_days_ago: 2,
              why_now: "Está aberto há 2 dias.",
              what_to_do: "Ver faturamentos de alto risco da Unimed.",
              if_ignored: "Os R$ 28.900,00 em jogo continuam em risco.",
            },
          ],
        } as never);
      if (url.includes("priority-queue"))
        return Promise.resolve({
          period_start: "",
          period_end: "",
          total_considered: 1,
          items: [{ severity: "warning", category: "agenda", title: "Ligar para 9 pacientes com risco de falta", message: "m", financial_impact: 3150, source: "insight" }],
        } as never);
      if (url.includes("billed-vs-denied-weekly"))
        return Promise.resolve({
          points: [
            { week_start: "2026-08-03", label: "S1", billed: 100000, denied: 4000 },
            { week_start: "2026-08-10", label: "S2", billed: 110000, denied: 11000 },
          ],
          annotation_index: 1,
          annotation_title: "S2 · semana de 10/08",
          annotation_text: "Glosa sobe de R$ 4 mil para R$ 11 mil",
          summary: "O faturamento cresceu nas últimas 2 semanas, mas a glosa descolou em S2 (semana de 10/08).",
        } as never);
      if (url.includes("recovered-value")) return Promise.resolve({ month_start: "2026-09-01", total: 23200, resolved_count: 1, items: [{ title: "Lote 0412 reenviado", value: 12300 }] } as never);
      return Promise.reject(new Error(`sem mock: ${url}`));
    });

    renderWithProviders(<CommandCenterToday dateFrom="2026-08-25" dateTo="2026-09-23" summary={SUMMARY} onNavigateTab={vi.fn()} onFocusAgenda={vi.fn()} />);

    expect(screen.getByText("Buraco financeiro")).toBeInTheDocument();
    expect(screen.getByText("Você faturou do que podia")).toBeInTheDocument();
    expect(await screen.findByText("A Unimed está recusando mais pagamentos que o normal")).toBeInTheDocument();
    expect(screen.getByText("Por que agora")).toBeInTheDocument();
    expect(screen.getByText("Se não fizer nada")).toBeInTheDocument();
    expect(screen.getByText(/detectado há 2 dias/)).toBeInTheDocument();
    expect(await screen.findByText("Ligar para 9 pacientes com risco de falta")).toBeInTheDocument();
    expect(screen.getByText("0 de 1 feitas")).toBeInTheDocument();
    expect(await screen.findByText("Glosa sobe de R$ 4 mil para R$ 11 mil")).toBeInTheDocument();
    expect(screen.getByText("Recuperado com o Insighta este mês")).toBeInTheDocument();
  });
});

describe("CommandCenterToday — indicadores sem dado ou perto de 100%", () => {
  it("sem pagamento de convênio mostra o motivo; 99,93% não vira '100%' nem '0% abaixo'", () => {
    vi.mocked(useAuth).mockReturnValue({ user: { tenant_id: "t1", sub: "u1", role: "owner" } } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(apiClient.get).mockImplementation(() => new Promise(() => undefined));
    const summary = { ...SUMMARY, margin_vs_contracted_pct: 99.93, avg_days_to_receive: null } as ExecutiveSummary;

    renderWithProviders(<CommandCenterToday dateFrom="2026-08-25" dateTo="2026-09-23" summary={summary} onNavigateTab={vi.fn()} onFocusAgenda={vi.fn()} />);

    expect(screen.getByText("99,9%")).toBeInTheDocument();
    expect(screen.getByText("Os 0,1% restantes ficaram abaixo do valor contratado.")).toBeInTheDocument();
    expect(screen.getByText("sem pagamento de convênio no período")).toBeInTheDocument();
    expect(screen.getByText("Nenhum convênio pagou cobranças deste período ainda.")).toBeInTheDocument();
  });
});
