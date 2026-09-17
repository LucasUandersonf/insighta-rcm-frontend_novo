import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { DataQualityPanel } from "@/components/dashboard/DataQualityPanel";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import type { DataQuality } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

// Épico F2.2 do Plano Diretor ("Qualidade de dado na origem") — quem
// lança atendimento incompleto (sem CID/procedimento), ordenado do pior
// pro melhor.
describe("DataQualityPanel", () => {
  it("mostra a taxa geral e cada atendente com amostra suficiente, pior primeiro", async () => {
    const data: DataQuality = {
      overall_completion_rate: 0.6,
      total_considered: 10,
      min_sample: 5,
      items: [
        { user_id: "u1", full_name: "Ana", complete_count: 1, total_count: 5, completion_rate: 0.2 },
        { user_id: "u2", full_name: "Beto", complete_count: 5, total_count: 5, completion_rate: 1.0 },
      ],
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<DataQualityPanel dateFrom="2026-09-01" dateTo="2026-09-07" />);

    await waitFor(() => expect(screen.getByText("Geral (todos os atendentes)")).toBeInTheDocument());
    expect(screen.getByText("60%")).toBeInTheDocument();
    expect(screen.getByText("Ana")).toBeInTheDocument();
    expect(screen.getByText("(1/5)")).toBeInTheDocument();
    expect(screen.getByText("20%")).toBeInTheDocument();
    expect(screen.getByText("Beto")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();

    // Pior primeiro no DOM.
    const names = screen.getAllByTitle(/Ana|Beto/).map((el) => el.textContent);
    expect(names[0]).toContain("Ana");
    expect(names[1]).toContain("Beto");
  });

  it("mensagem honesta quando nenhum atendente tem amostra suficiente ainda", async () => {
    const data: DataQuality = { overall_completion_rate: null, total_considered: 0, min_sample: 5, items: [] };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<DataQualityPanel dateFrom="2026-09-01" dateTo="2026-09-07" />);

    await waitFor(() =>
      expect(screen.getByText(/Nenhum atendente com amostra suficiente ainda/)).toBeInTheDocument()
    );
  });

  it("busca o endpoint com o período informado", async () => {
    const data: DataQuality = { overall_completion_rate: null, total_considered: 0, min_sample: 5, items: [] };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<DataQualityPanel dateFrom="2026-09-01" dateTo="2026-09-07" />);

    await waitFor(() =>
      expect(apiClient.get).toHaveBeenCalledWith(
        "/api/v1/analytics/data-quality?date_from=2026-09-01&date_to=2026-09-07"
      )
    );
  });
});
