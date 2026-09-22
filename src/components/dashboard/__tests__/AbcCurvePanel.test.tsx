import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { AbcCurvePanel } from "@/components/dashboard/AbcCurvePanel";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import type { AbcCurve } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

describe("AbcCurvePanel", () => {
  it("lista os materiais por valor consumido, com a classe de cada um", async () => {
    const data: AbcCurve = {
      period_start: "2026-09-01",
      period_end: "2026-09-07",
      items: [
        { material_id: "m1", nome: "Prótese", valor_consumido: 8000, classe: "A" },
        { material_id: "m2", nome: "Gaze", valor_consumido: 1500, classe: "B" },
        { material_id: "m3", nome: "Luva", valor_consumido: 500, classe: "C" },
      ],
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<AbcCurvePanel dateFrom="2026-09-01" dateTo="2026-09-07" />);

    await waitFor(() => expect(screen.getByText("Prótese")).toBeInTheDocument());
    expect(screen.getByText("Gaze")).toBeInTheDocument();
    expect(screen.getByText("Luva")).toBeInTheDocument();
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
    expect(screen.getByText("C")).toBeInTheDocument();
  });

  it("mensagem honesta quando não há consumo no período", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ period_start: "2026-09-01", period_end: "2026-09-07", items: [] } as AbcCurve);

    renderWithProviders(<AbcCurvePanel dateFrom="2026-09-01" dateTo="2026-09-07" />);

    await waitFor(() => expect(screen.getByText(/Nenhum consumo de material registrado/)).toBeInTheDocument());
  });
});
