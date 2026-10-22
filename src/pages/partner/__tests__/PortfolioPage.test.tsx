import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PortfolioPage } from "@/pages/partner/PortfolioPage";
import { enterClinic, partnerApiClient, type Portfolio } from "@/lib/partner-api-client";
import { renderWithProviders } from "@/test/utils";

vi.mock("@/lib/partner-api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/partner-api-client")>();
  return {
    ...actual,
    partnerApiClient: { me: vi.fn(), portfolio: vi.fn(), openClinic: vi.fn(), commission: vi.fn(), logout: vi.fn() },
    enterClinic: vi.fn(),
    clearPartnerSession: vi.fn(),
  };
});

const clinic = {
  tenant_id: "t-1",
  trade_name: "Clínica Sorriso",
  acting_role: "financeiro",
  granted_at: "2026-10-01T10:00:00Z",
  last_session_at: null,
  snapshot_date: "2026-10-22",
  billed_30d: 180000,
  recovered_month: 4200,
  recovered_cumulative: 21000,
  recoverable: 12500,
  due_7_days: 3000,
  open_demands: 4,
  stalled_demands: 1,
  stale_level: 2,
  oldest_load_days: 12,
  health_score: 71,
  attention: ["Dado parado há 12 dias", "R$ 3.000 vence em 7 dias"],
};

describe("PortfolioPage", () => {
  beforeEach(() => {
    vi.mocked(partnerApiClient.me).mockResolvedValue({
      user_id: "u", email: "a@b.com", full_name: "Ana Contadora", role: "partner_admin",
      partner_id: "p", partner_name: "Escritório Contábil", must_change_password: false,
    });
  });

  it("mostra a carteira em ordem de urgência e abre a clínica", async () => {
    const portfolio: Portfolio = {
      partner_name: "Escritório Contábil",
      clinics: [clinic],
      total_recoverable: 12500,
      total_recovered_month: 4200,
      clinics_needing_attention: 1,
    };
    vi.mocked(partnerApiClient.portfolio).mockResolvedValue(portfolio);
    const session = { access_token: "tok", expires_in: 1800, tenant_id: "t-1", trade_name: "Clínica Sorriso", role: "financeiro" };
    vi.mocked(partnerApiClient.openClinic).mockResolvedValue(session);
    renderWithProviders(<PortfolioPage />);

    expect(await screen.findByText("Clínica Sorriso")).toBeInTheDocument();
    expect(screen.getByText("Dado parado há 12 dias")).toBeInTheDocument();
    expect(screen.getByText("Dado parado")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Comissão" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Abrir clínica" }));
    expect(partnerApiClient.openClinic).toHaveBeenCalledWith("t-1");
    expect(enterClinic).toHaveBeenCalledWith(session, "Escritório Contábil");
  });

  it("sem clínica autorizada, explica como a clínica libera o acesso", async () => {
    vi.mocked(partnerApiClient.portfolio).mockResolvedValue({
      partner_name: "Escritório Contábil", clinics: [], total_recoverable: 0, total_recovered_month: 0, clinics_needing_attention: 0,
    });
    renderWithProviders(<PortfolioPage />);
    expect(await screen.findByText(/Nenhuma clínica autorizou o seu escritório ainda/)).toBeInTheDocument();
  });
});
