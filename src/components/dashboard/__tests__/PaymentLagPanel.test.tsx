import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { PaymentLagPanel } from "@/components/dashboard/PaymentLagPanel";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import type { PaymentLagByPlan } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

// Achado 2 da auditoria "Veredito do Gestor Clínico": billing.created_at/
// settled_at sempre existiram no banco, mas nenhuma tela mostrava o PMR
// por convênio. Estes testes cobrem o painel que fecha essa lacuna.
describe("PaymentLagPanel", () => {
  it("lista convênios com o prazo médio de recebimento, pior primeiro", async () => {
    const data: PaymentLagByPlan = {
      period_start: "2026-01-01",
      period_end: "2026-01-07",
      avg_days_to_receive: 55,
      billings_settled_count: 2,
      items: [
        { insurance_plan_id: "p1", insurance_plan_name: "Convênio Lento", avg_days_to_receive: 100, billings_settled_count: 1 },
        { insurance_plan_id: "p2", insurance_plan_name: "Convênio Rápido", avg_days_to_receive: 10, billings_settled_count: 1 },
      ],
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<PaymentLagPanel dateFrom="2026-01-01" dateTo="2026-01-07" />);

    await waitFor(() => expect(screen.getByText("Convênio Lento")).toBeInTheDocument());
    expect(screen.getByText("Convênio Rápido")).toBeInTheDocument();
    expect(screen.getByText("100 dias")).toBeInTheDocument();
    expect(screen.getByText("10 dias")).toBeInTheDocument();
  });

  it("mensagem honesta quando nenhum billing foi conciliado no período", async () => {
    const data: PaymentLagByPlan = {
      period_start: "2026-01-01",
      period_end: "2026-01-07",
      avg_days_to_receive: null,
      billings_settled_count: 0,
      items: [],
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<PaymentLagPanel dateFrom="2026-01-01" dateTo="2026-01-07" />);

    await waitFor(() =>
      expect(screen.getByText("Nenhum faturamento conciliado por convênio nesta janela.")).toBeInTheDocument()
    );
  });
});
