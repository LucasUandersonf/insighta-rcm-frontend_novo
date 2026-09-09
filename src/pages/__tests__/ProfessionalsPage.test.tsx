import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { ProfessionalsPage } from "@/pages/ProfessionalsPage";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import type { Professional } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

function makeProfessional(overrides: Partial<Professional> = {}): Professional {
  return {
    id: "p1",
    full_name: "Dr. X",
    professional_registry: null,
    specialty: null,
    is_active: true,
    availability: [],
    ...overrides,
  };
}

describe("ProfessionalsPage — deep-link do Radar de Profissional Fora do Padrão (item 4 do roadmap)", () => {
  it("sem ?highlight= na URL, nenhuma linha ganha o realce", async () => {
    vi.mocked(apiClient.get).mockResolvedValue([
      makeProfessional({ id: "p1", full_name: "Dr. X" }),
      makeProfessional({ id: "p2", full_name: "Dra. Y" }),
    ] as never);

    renderWithProviders(<ProfessionalsPage />);

    await waitFor(() => expect(screen.getByText("Dr. X")).toBeInTheDocument());
    const row = screen.getByText("Dr. X").closest("tr");
    expect(row).not.toHaveClass("ring-pending");
  });

  it("com ?highlight=<id>, a linha do profissional certo ganha o realce", async () => {
    vi.mocked(apiClient.get).mockResolvedValue([
      makeProfessional({ id: "p1", full_name: "Dr. X" }),
      makeProfessional({ id: "p2", full_name: "Dra. Y" }),
    ] as never);

    renderWithProviders(<ProfessionalsPage />, { route: "/professionals?highlight=p2" });

    await waitFor(() => expect(screen.getByText("Dra. Y")).toBeInTheDocument());
    const highlighted = screen.getByText("Dra. Y").closest("tr");
    const notHighlighted = screen.getByText("Dr. X").closest("tr");
    expect(highlighted).toHaveClass("ring-pending");
    expect(notHighlighted).not.toHaveClass("ring-pending");
  });
});
