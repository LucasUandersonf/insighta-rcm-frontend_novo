import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { MoneyPathBlock, MoneyPathPanoramaRows } from "@/components/money/MoneyPathSummary";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import type { CashForecast, PreSubmissionOverview, RecoveryCenter } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

let mockRole = "owner";
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { sub: "u1", tenant_id: "t1", role: mockRole } }),
}));

const CASH = {
  expected_net: 48000,
  overdue_submitted: 5000,
  overdue_unsent: 1000,
  open_gross: 70000,
} as CashForecast;

const RECOVERY = { recoverable: 12000, due_7_days: 3000, in_appeal: 0 } as RecoveryCenter;

const CHECK = { blocking_value: 2500, review_groups: 2 } as PreSubmissionOverview;

function mockApi() {
  vi.mocked(apiClient.get).mockImplementation(((path: string) => {
    if (path.includes("caixa-13-semanas")) return Promise.resolve(CASH);
    if (path.includes("recuperacao")) return Promise.resolve(RECOVERY);
    return Promise.resolve(CHECK);
  }) as never);
}

describe("MoneyPathPanoramaRows", () => {
  it("mostra o que deve entrar e o que dá para recuperar, com o atrasado e o prazo", async () => {
    mockRole = "owner";
    mockApi();
    renderWithProviders(<MoneyPathPanoramaRows />);
    expect(await screen.findByText("Deve entrar em 13 semanas")).toBeInTheDocument();
    expect(screen.getByText(/R\$\s?48\.000,00/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /R\$\s?6\.000,00 já passaram do prazo/ })).toHaveAttribute("href", "/caixa");
    expect(await screen.findByText("Dá para recuperar")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /prazo de recurso acabando em 7 dias/ })).toHaveAttribute("href", "/recuperacao");
  });

  it("não aparece nem consulta para quem não vê o financeiro", () => {
    mockRole = "recepcao";
    vi.mocked(apiClient.get).mockClear();
    renderWithProviders(<MoneyPathPanoramaRows />);
    expect(screen.queryByText("Deve entrar em 13 semanas")).not.toBeInTheDocument();
    expect(apiClient.get).not.toHaveBeenCalled();
  });
});

describe("MoneyPathBlock", () => {
  it("leva aos três números do caminho do dinheiro", async () => {
    mockRole = "financeiro";
    mockApi();
    renderWithProviders(<MoneyPathBlock />);
    expect(await screen.findByRole("heading", { name: "Caminho do dinheiro" })).toBeInTheDocument();
    expect((await screen.findByText("Com problema no próximo envio")).closest("a")).toHaveAttribute("href", "/conferencia-envio");
    expect(screen.getByText("2 lotes para revisar antes de enviar")).toBeInTheDocument();
    expect(screen.getByText("Dá para recuperar").closest("a")).toHaveAttribute("href", "/recuperacao");
  });
});
