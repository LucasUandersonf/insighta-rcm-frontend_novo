import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { AverageTicketPanel } from "@/components/dashboard/AverageTicketPanel";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import { expectNoA11yViolations } from "@/test/a11y";
import type { AverageTicket } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

describe("AverageTicketPanel", () => {
  it("mostra o ticket médio geral e as quebras por canal e procedimento", async () => {
    const data: AverageTicket = {
      period_start: "2026-09-01",
      period_end: "2026-09-07",
      overall: { value: 250, previous_value: 200, delta_pct: 25 },
      billing_count: 10,
      by_channel: [{ channel: "whatsapp", billing_count: 6, average_ticket: 260 }],
      by_procedure: [{ procedure_code: "10101012", procedure_name: "Consulta", billing_count: 6, average_ticket: 240 }],
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    const { container } = renderWithProviders(<AverageTicketPanel dateFrom="2026-09-01" dateTo="2026-09-07" />);

    await waitFor(() => expect(screen.getByText(/10 lançamentos no período/)).toBeInTheDocument());
    expect(screen.getByText("WhatsApp")).toBeInTheDocument();
    expect(screen.getByText("Consulta")).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it("mensagem honesta quando não há faturamento, nunca R$ 0 inventado", async () => {
    const data: AverageTicket = {
      period_start: "2026-09-01",
      period_end: "2026-09-07",
      overall: null,
      billing_count: 0,
      by_channel: [],
      by_procedure: [],
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<AverageTicketPanel dateFrom="2026-09-01" dateTo="2026-09-07" />);

    await waitFor(() => expect(screen.getByText(/Nenhum faturamento neste período ainda/)).toBeInTheDocument());
  });

  it("sem período anterior pra comparar, não mostra pílula de tendência", async () => {
    const data: AverageTicket = {
      period_start: "2026-09-01",
      period_end: "2026-09-07",
      overall: { value: 180, previous_value: 180, delta_pct: null },
      billing_count: 3,
      by_channel: [],
      by_procedure: [],
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<AverageTicketPanel dateFrom="2026-09-01" dateTo="2026-09-07" />);

    await waitFor(() => expect(screen.getByText(/3 lançamentos no período/)).toBeInTheDocument());
    expect(screen.queryByText(/vs\. período anterior/)).not.toBeInTheDocument();
  });
});
