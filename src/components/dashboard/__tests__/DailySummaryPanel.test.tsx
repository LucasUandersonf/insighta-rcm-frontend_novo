import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { DailySummaryPanel } from "@/components/dashboard/DailySummaryPanel";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import { expectNoA11yViolations } from "@/test/a11y";
import type { DailySummary } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

describe("DailySummaryPanel", () => {
  it("mostra a manchete e as frases seguintes do resumo do dia", async () => {
    const data: DailySummary = {
      date: "2026-01-07",
      headline: "A agenda de hoje tem 3 atendimentos previstos.",
      sentences: [
        "A agenda de hoje tem 3 atendimentos previstos.",
        "Faturado hoje: R$ 450.00.",
        "Ao encaixar um paciente novo hoje, priorize Unimed Nacional — melhor combinação de prazo de recebimento e perda financeira.",
      ],
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<DailySummaryPanel />);

    await waitFor(() => expect(screen.getByText("A agenda de hoje tem 3 atendimentos previstos.")).toBeInTheDocument());
    expect(screen.getByText("Faturado hoje: R$ 450.00.")).toBeInTheDocument();
    expect(screen.getByText(/priorize Unimed Nacional/)).toBeInTheDocument();
  });

  it("mostra só a manchete quando não há mais nenhuma frase (sem dado sobre hoje)", async () => {
    const data: DailySummary = {
      date: "2026-01-07",
      headline: "Nenhum atendimento agendado pra hoje ainda.",
      sentences: ["Nenhum atendimento agendado pra hoje ainda."],
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<DailySummaryPanel />);

    await waitFor(() => expect(screen.getByText("Nenhum atendimento agendado pra hoje ainda.")).toBeInTheDocument());
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("não tem violações de acessibilidade", async () => {
    const data: DailySummary = {
      date: "2026-01-07",
      headline: "A agenda de hoje tem 3 atendimentos previstos.",
      sentences: [
        "A agenda de hoje tem 3 atendimentos previstos.",
        "Faturado hoje: R$ 450.00.",
        "Ao encaixar um paciente novo hoje, priorize Unimed Nacional — melhor combinação de prazo de recebimento e perda financeira.",
      ],
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    const { container } = renderWithProviders(<DailySummaryPanel />);

    await waitFor(() => expect(screen.getByText("A agenda de hoje tem 3 atendimentos previstos.")).toBeInTheDocument());
    await expectNoA11yViolations(container);
  });
});
