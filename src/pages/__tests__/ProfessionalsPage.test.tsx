import { describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProfessionalsPage } from "@/pages/ProfessionalsPage";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import { expectNoA11yViolations } from "@/test/a11y";
import type { PlannedAbsence, Professional } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } };
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
    contract_type: null,
    commission_rate: null,
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
    await waitFor(() => expect(screen.getAllByRole("dialog")).toHaveLength(2));
    const dialogs = screen.getAllByRole("dialog");
    const confirmDialog = dialogs[dialogs.length - 1];
    await user.click(within(confirmDialog).getByRole("button", { name: /^remover$/i }));
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

// "Mapa de Dados Insighta" — Domínio Profissional (Onda 2): tipo de
// contrato + comissão, alimenta a Rentabilidade por profissional para
// quem é remunerado por comissão (PJ/autônomo/cooperado).
describe("ProfessionalsPage — tipo de contrato e comissão", () => {
  it("cadastra um profissional novo com tipo de contrato e comissão", async () => {
    vi.mocked(apiClient.get).mockResolvedValue([] as never);
    vi.mocked(apiClient.post).mockResolvedValue(makeProfessional({ contract_type: "pj", commission_rate: 35 }));
    const user = userEvent.setup();

    renderWithProviders(<ProfessionalsPage />);
    await waitFor(() => expect(screen.getByRole("button", { name: /Novo profissional/ })).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /Novo profissional/ }));

    await user.type(await screen.findByLabelText(/Nome completo/), "Dra. Comissionada");
    await user.selectOptions(screen.getByLabelText(/Tipo de contrato/), "pj");
    await user.type(screen.getByLabelText(/Comissão sobre faturamento/), "35");

    await user.click(screen.getByRole("button", { name: "Criar profissional" }));

    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith(
        "/api/v1/professionals",
        expect.objectContaining({ contract_type: "pj", commission_rate: 35 })
      )
    );
  });

  it("pré-preenche e edita o tipo de contrato/comissão de um profissional existente", async () => {
    vi.mocked(apiClient.get).mockResolvedValue([
      makeProfessional({ id: "p1", full_name: "Dr. X", contract_type: "clt", commission_rate: null }),
    ] as never);
    vi.mocked(apiClient.patch).mockResolvedValue(makeProfessional({ contract_type: "cooperado", commission_rate: 20 }));
    const user = userEvent.setup();

    renderWithProviders(<ProfessionalsPage />);
    await waitFor(() => expect(screen.getByText("Dr. X")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /Editar/ }));

    expect(await screen.findByLabelText(/Tipo de contrato/)).toHaveValue("clt");
    await user.selectOptions(screen.getByLabelText(/Tipo de contrato/), "cooperado");
    await user.clear(screen.getByLabelText(/Comissão sobre faturamento/));
    await user.type(screen.getByLabelText(/Comissão sobre faturamento/), "20");

    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() =>
      expect(apiClient.patch).toHaveBeenCalledWith(
        "/api/v1/professionals/p1",
        expect.objectContaining({ contract_type: "cooperado", commission_rate: 20 })
      )
    );
  });

  it("mostra o tipo de contrato e comissão na listagem", async () => {
    vi.mocked(apiClient.get).mockResolvedValue([
      makeProfessional({ id: "p1", full_name: "Dr. X", contract_type: "pj", commission_rate: 35 }),
    ] as never);

    renderWithProviders(<ProfessionalsPage />);

    await waitFor(() => expect(screen.getByText("PJ · 35%")).toBeInTheDocument());
  });

  it("não tem violações de acessibilidade", async () => {
    vi.mocked(apiClient.get).mockResolvedValue([
      makeProfessional({ id: "p1", full_name: "Dr. X", contract_type: "pj", commission_rate: 35 }),
    ] as never);

    const { container } = renderWithProviders(<ProfessionalsPage />);

    await waitFor(() => expect(screen.getByText("PJ · 35%")).toBeInTheDocument());
    await expectNoA11yViolations(container);
  });
});
