import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AgendaRiscoPage } from "@/pages/AgendaRiscoPage";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import type { PaginatedResponse, UpcomingRiskAppointment } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

function page(overrides: Partial<PaginatedResponse<UpcomingRiskAppointment>> = {}): PaginatedResponse<UpcomingRiskAppointment> {
  return { items: [], total: 0, limit: 20, offset: 0, ...overrides };
}

describe("AgendaRiscoPage", () => {
  it("lista paciente, dia/horário, profissional e risco", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(
      page({
        items: [
          {
            appointment_id: "a1",
            patient_full_name: "Maria Silva",
            scheduled_at: "2026-09-20T14:30:00Z",
            risk_level: "alto",
            professional_name: "Dra. Ana",
          },
        ],
        total: 1,
      }) as never
    );

    renderWithProviders(<AgendaRiscoPage />);

    expect(await screen.findByText("Maria Silva")).toBeInTheDocument();
    expect(screen.getByText("Dra. Ana")).toBeInTheDocument();
    expect(screen.getByText("Alto")).toBeInTheDocument();
    // Sem patient_id, o nome não é um link — nunca aponta pra uma ficha
    // que não tem como abrir.
    expect(screen.queryByRole("link", { name: "Maria Silva" })).not.toBeInTheDocument();
  });

  it("com patient_id, o nome do paciente linka pra Ficha do Paciente (Fase 4)", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(
      page({
        items: [
          {
            appointment_id: "a1",
            patient_id: "p1",
            patient_full_name: "Maria Silva",
            scheduled_at: "2026-09-20T14:30:00Z",
            risk_level: "alto",
            professional_name: "Dra. Ana",
          },
        ],
        total: 1,
      }) as never
    );

    renderWithProviders(<AgendaRiscoPage />);

    const link = await screen.findByRole("link", { name: "Maria Silva" });
    expect(link).toHaveAttribute("href", "/pacientes?patient_id=p1");
  });

  it("sem profissional vinculado, mostra travessão em vez de vazio", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(
      page({
        items: [
          {
            appointment_id: "a1",
            patient_full_name: "João Souza",
            scheduled_at: "2026-09-20T14:30:00Z",
            risk_level: "medio",
            professional_name: null,
          },
        ],
        total: 1,
      }) as never
    );

    renderWithProviders(<AgendaRiscoPage />);

    await screen.findByText("João Souza");
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("lista vazia mostra o estado 'agenda limpa'", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(page() as never);

    renderWithProviders(<AgendaRiscoPage />);

    expect(await screen.findByText(/agenda está limpa/)).toBeInTheDocument();
  });

  it("pagina a lista completa ao clicar em 'Próxima'", async () => {
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      const offset = new URL(url, "http://test").searchParams.get("offset");
      if (offset === "20") {
        return Promise.resolve(
          page({ items: [{ appointment_id: "a2", patient_full_name: "Segunda Página", scheduled_at: "2026-09-21T10:00:00Z", risk_level: "alto" }], total: 21, offset: 20 }) as never
        );
      }
      return Promise.resolve(
        page({ items: [{ appointment_id: "a1", patient_full_name: "Primeira Página", scheduled_at: "2026-09-20T10:00:00Z", risk_level: "alto" }], total: 21 }) as never
      );
    });
    const user = userEvent.setup();

    renderWithProviders(<AgendaRiscoPage />);

    await screen.findByText("Primeira Página");
    await user.click(screen.getByRole("button", { name: "Próxima página" }));
    expect(await screen.findByText("Segunda Página")).toBeInTheDocument();
  });
});
