import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { AgendaPlanPriorityPanel } from "@/components/dashboard/AgendaPlanPriorityPanel";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import { expectNoA11yViolations } from "@/test/a11y";
import type { AgendaPlanPriority } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

describe("AgendaPlanPriorityPanel", () => {
  it("recomenda o convênio #1 e lista o ranking completo", async () => {
    const data: AgendaPlanPriority = {
      period_start: "2026-01-01",
      period_end: "2026-01-07",
      items: [
        { insurance_plan_id: "p1", insurance_plan_name: "Convênio Rápido e Limpo", avg_days_to_receive: 10, total_loss: 0, priority_rank: 1 },
        { insurance_plan_id: "p2", insurance_plan_name: "Convênio Lento e Furado", avg_days_to_receive: 100, total_loss: 500, priority_rank: 2 },
      ],
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<AgendaPlanPriorityPanel dateFrom="2026-01-01" dateTo="2026-01-07" />);

    await waitFor(() => expect(screen.getByText(/Priorize/)).toBeInTheDocument());
    // Aparece duas vezes: na recomendação em texto e na lista rankeada.
    expect(screen.getAllByText("Convênio Rápido e Limpo").length).toBeGreaterThan(0);
    expect(screen.getByText("Convênio Lento e Furado")).toBeInTheDocument();
  });

  it("mensagem honesta sem convênio com PMR calculável", async () => {
    const data: AgendaPlanPriority = { period_start: "2026-01-01", period_end: "2026-01-07", items: [] };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<AgendaPlanPriorityPanel dateFrom="2026-01-01" dateTo="2026-01-07" />);

    await waitFor(() =>
      expect(screen.getByText("Nenhum convênio com prazo de recebimento calculável nesta janela.")).toBeInTheDocument()
    );
  });

  it("não tem violações de acessibilidade", async () => {
    const data: AgendaPlanPriority = {
      period_start: "2026-01-01",
      period_end: "2026-01-07",
      items: [
        { insurance_plan_id: "p1", insurance_plan_name: "Convênio Rápido e Limpo", avg_days_to_receive: 10, total_loss: 0, priority_rank: 1 },
        { insurance_plan_id: "p2", insurance_plan_name: "Convênio Lento e Furado", avg_days_to_receive: 100, total_loss: 500, priority_rank: 2 },
      ],
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    const { container } = renderWithProviders(<AgendaPlanPriorityPanel dateFrom="2026-01-01" dateTo="2026-01-07" />);

    await waitFor(() => expect(screen.getByText(/Priorize/)).toBeInTheDocument());
    await expectNoA11yViolations(container);
  });
});
