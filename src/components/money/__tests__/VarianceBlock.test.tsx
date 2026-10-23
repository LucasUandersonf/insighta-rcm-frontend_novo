import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { VarianceBlock } from "@/components/money/VarianceBlock";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import type { VarianceDiagnosis } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

let mockRole = "owner";
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { sub: "u1", tenant_id: "t1", role: mockRole } }),
}));

const DATA: VarianceDiagnosis = {
  date_from: "2026-10-01",
  date_to: "2026-10-22",
  prev_from: "2026-09-01",
  prev_to: "2026-09-22",
  billed_before: 10000,
  billed_after: 8000,
  delta: -2000,
  delta_pct: -0.2,
  accounts_before: 100,
  accounts_after: 80,
  volume_effect: -2000,
  mix_effect: 150,
  price_effect: -150,
  no_shows_before: 5,
  no_shows_after: 17,
  no_show_cost: 1200,
  denied_before: 300,
  denied_after: 500,
  received_before: 9000,
  received_after: 7000,
  headline: "O faturamento caiu 20%. 87% disso veio de menos contas (80 contra 100). Foram 12 faltas a mais.",
  plan_movers: [{ name: "Unimed", before: 6000, after: 4500, delta: -1500 }],
  professional_movers: [{ name: "Dra. Ana", before: 3000, after: 2200, delta: -800 }],
};

describe("VarianceBlock", () => {
  it("mostra a frase, as três partes e quem mais moveu", async () => {
    mockRole = "owner";
    vi.mocked(apiClient.get).mockResolvedValue(DATA as never);
    renderWithProviders(<VarianceBlock />);
    expect(await screen.findByText(/O faturamento caiu 20%/)).toBeInTheDocument();
    expect(screen.getByText("Volume de contas")).toBeInTheDocument();
    expect(screen.getByText(/−R\$\s?2\.000,00/)).toBeInTheDocument();
    expect(screen.getAllByText(/12 faltas a mais/)).toHaveLength(1);
    expect(screen.getByText(/Glosa R\$\s?200,00 maior/)).toBeInTheDocument();
    expect(screen.getByText("Unimed")).toBeInTheDocument();
    expect(screen.getByText("Dra. Ana")).toBeInTheDocument();
  });

  it("some sem base para comparar e para quem não vê o financeiro", async () => {
    mockRole = "owner";
    vi.mocked(apiClient.get).mockResolvedValue({ ...DATA, headline: null } as never);
    renderWithProviders(<VarianceBlock />);
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByText("Por que o faturamento mudou")).not.toBeInTheDocument();

    mockRole = "recepcao";
    vi.mocked(apiClient.get).mockClear();
    renderWithProviders(<VarianceBlock />);
    expect(apiClient.get).not.toHaveBeenCalled();
  });
});
