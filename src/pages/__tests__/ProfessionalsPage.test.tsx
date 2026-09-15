import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProfessionalsPage } from "@/pages/ProfessionalsPage";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import type { PlannedAbsence, Professional } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn(), post: vi.fn(), delete: vi.fn() } };
});

function makeProfessional(overrides: Partial<Professional> = {}): Professional {
  return {
    id: "p1",
    full_name: "Dr. X",
    professional_registry: null,
    specialty: null,
    is_active: true,
    availability: [],
    planned_absences: [],
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

// "Mapa de Dados Insighta" — Domínio Profissional (Onda 1): ausência
// futura planejada, editada dentro do modal de edição de profissional.
describe("ProfessionalsPage — ausências planejadas", () => {
  it("lista, adiciona e remove uma ausência planejada ao editar um profissional existente", async () => {
    const existingAbsence: PlannedAbsence = {
      id: "abs-1",
      start_date: "2026-07-01",
      end_date: "2026-07-10",
      reason: "Férias",
      created_at: "2026-01-01T00:00:00Z",
    };
    vi.mocked(apiClient.get).mockResolvedValue([
      makeProfessional({ id: "p1", full_name: "Dr. X", planned_absences: [existingAbsence] }),
    ] as never);
    const newAbsence: PlannedAbsence = {
      id: "abs-2",
      start_date: "2026-12-20",
      end_date: "2027-01-05",
      reason: "Recesso",
      created_at: "2026-01-01T00:00:00Z",
    };
    vi.mocked(apiClient.post).mockResolvedValue(newAbsence);
    vi.mocked(apiClient.delete).mockResolvedValue(undefined);
    const user = userEvent.setup();

    renderWithProviders(<ProfessionalsPage />);
    await waitFor(() => expect(screen.getByText("Dr. X")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /Editar/ }));

    expect(await screen.findByText(/01\/07\/2026–10\/07\/2026 — Férias/)).toBeInTheDocument();

    await user.type(screen.getByLabelText("Início"), "2026-12-20");
    await user.type(screen.getByLabelText("Fim"), "2027-01-05");
    await user.type(screen.getByLabelText(/Motivo/), "Recesso");
    await user.click(screen.getByRole("button", { name: "+ Adicionar" }));

    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith("/api/v1/professionals/p1/planned-absences", {
        start_date: "2026-12-20",
        end_date: "2027-01-05",
        reason: "Recesso",
      })
    );
    expect(await screen.findByText(/20\/12\/2026–05\/01\/2027 — Recesso/)).toBeInTheDocument();

    await user.click(screen.getByLabelText(/Remover ausência de 01\/07\/2026/));
    await waitFor(() =>
      expect(apiClient.delete).toHaveBeenCalledWith("/api/v1/professionals/p1/planned-absences/abs-1")
    );
    expect(screen.queryByText(/01\/07\/2026–10\/07\/2026/)).not.toBeInTheDocument();
  });

  it("não mostra o editor de ausências ao cadastrar um profissional novo", async () => {
    vi.mocked(apiClient.get).mockResolvedValue([makeProfessional()] as never);
    const user = userEvent.setup();

    renderWithProviders(<ProfessionalsPage />);
    await waitFor(() => expect(screen.getByRole("button", { name: /Novo profissional/ })).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /Novo profissional/ }));

    expect(await screen.findByRole("heading", { name: "Novo profissional" })).toBeInTheDocument();
    expect(screen.queryByText(/Ausências planejadas/)).not.toBeInTheDocument();
  });
});
