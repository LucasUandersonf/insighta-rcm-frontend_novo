import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { ApprovalsStrip } from "@/components/actions/ApprovalsStrip";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import type { ApprovalPlan } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn(), post: vi.fn() } };
});

let mockRole = "owner";
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { sub: "u1", tenant_id: "t1", role: mockRole } }),
}));

const PLAN: ApprovalPlan = {
  day: "2026-10-23",
  slots: [
    {
      appointment_id: "a1",
      at: "2026-10-23T09:00:00-03:00",
      patient: "Carlos Risco",
      professional: "Dra. Ana",
      procedure: null,
      candidates: [{ waitlist_id: "w1", patient: "Eva Espera", waiting_since: "2026-10-01" }],
    },
    { appointment_id: "a2", at: "2026-10-23T15:00:00-03:00", patient: "Gil Sol", professional: null, procedure: null, candidates: [] },
  ],
  appeals: [
    { billing_id: "b1", plan_name: "Unimed", patient: "Ana", value: 80, reason: "1801", deadline: "2026-10-27", days_left: 5 },
  ],
  appeals_value: 80,
  confirm_demand_id: null,
};

describe("ApprovalsStrip", () => {
  it("prepara as duas aprovações e envia com um clique", async () => {
    mockRole = "owner";
    vi.mocked(apiClient.get).mockResolvedValue(PLAN as never);
    vi.mocked(apiClient.post).mockResolvedValue({ demand_id: "d1", email_sent: true } as never);
    renderWithProviders(<ApprovalsStrip />);
    expect(await screen.findByText("Confirmar 2 consultas de amanhã com risco alto de falta")).toBeInTheDocument();
    expect(screen.getByText(/Para uma delas já há quem da lista de espera/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver lista" }));
    expect(screen.getByText(/lista de espera: Eva Espera/)).toBeInTheDocument();
    expect(screen.getByText("Protocolar 1 recurso de glosa com prazo em até 7 dias")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Aprovar e enviar" }));
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith("/api/v1/acoes/confirmar-amanha"));
    fireEvent.click(screen.getByRole("button", { name: "Enviar ao Faturamento" }));
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith("/api/v1/acoes/recursos"));
  });

  it("financeiro vê, mas quem delega é o gestor", async () => {
    mockRole = "financeiro";
    vi.mocked(apiClient.get).mockResolvedValue(PLAN as never);
    renderWithProviders(<ApprovalsStrip />);
    expect(await screen.findByText(/Confirmar 2 consultas/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Aprovar e enviar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enviar ao Faturamento" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver na Central" })).toBeInTheDocument();
  });

  it("recursos já enviados hoje não pedem aprovação de novo", async () => {
    mockRole = "owner";
    vi.mocked(apiClient.get).mockResolvedValue({ ...PLAN, confirm_demand_id: "d1", appeals_demand_id: "d2" } as never);
    renderWithProviders(<ApprovalsStrip />);
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByText("Para aprovar hoje")).not.toBeInTheDocument();
  });

  it("não aparece com a confirmação já enviada e sem recursos", async () => {
    mockRole = "owner";
    vi.mocked(apiClient.get).mockResolvedValue({ ...PLAN, confirm_demand_id: "d1", appeals: [], appeals_value: 0 } as never);
    renderWithProviders(<ApprovalsStrip />);
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByText("Para aprovar hoje")).not.toBeInTheDocument();
  });
});
