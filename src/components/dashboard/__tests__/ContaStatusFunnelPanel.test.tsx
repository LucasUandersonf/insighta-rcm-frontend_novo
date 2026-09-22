import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { ContaStatusFunnelPanel } from "@/components/dashboard/ContaStatusFunnelPanel";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import { expectNoA11yViolations } from "@/test/a11y";
import type { ContaStatusFunnel } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

function mockFunnel(funnel: ContaStatusFunnel) {
  vi.mocked(apiClient.get).mockImplementation((url: string) => {
    if (url.includes("conta-status-funnel")) return Promise.resolve(funnel as never);
    return Promise.reject(new Error(`unexpected url: ${url}`));
  });
}

describe("ContaStatusFunnelPanel", () => {
  it("mostra a contagem por status do funil", async () => {
    mockFunnel({
      aberta: 3,
      pre_faturada: 1,
      faturada: 5,
      em_auditoria: 2,
      glosada_parcial: 0,
      fechada: 10,
      cancelada: 1,
      stale_em_auditoria_count: 0,
      oldest_em_auditoria_age_days: null,
    });

    renderWithProviders(<ContaStatusFunnelPanel />);

    expect(screen.getByText("Contas")).toBeInTheDocument();
    expect(await screen.findByText("Aberta")).toBeInTheDocument();
    expect(screen.getByText("Fechada")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
  });

  it("sem nenhuma conta, mostra estado vazio", async () => {
    mockFunnel({
      aberta: 0,
      pre_faturada: 0,
      faturada: 0,
      em_auditoria: 0,
      glosada_parcial: 0,
      fechada: 0,
      cancelada: 0,
      stale_em_auditoria_count: 0,
      oldest_em_auditoria_age_days: null,
    });

    renderWithProviders(<ContaStatusFunnelPanel />);

    expect(await screen.findByText("Nenhuma conta registrada ainda nesta janela.")).toBeInTheDocument();
  });

  it("com contas paradas em auditoria, mostra o alerta com a idade da mais antiga", async () => {
    mockFunnel({
      aberta: 1,
      pre_faturada: 0,
      faturada: 0,
      em_auditoria: 3,
      glosada_parcial: 0,
      fechada: 0,
      cancelada: 0,
      stale_em_auditoria_count: 2,
      oldest_em_auditoria_age_days: 45,
    });

    renderWithProviders(<ContaStatusFunnelPanel />);

    expect(await screen.findByText(/2 contas estão paradas em auditoria/)).toBeInTheDocument();
    expect(screen.getByText(/a mais antiga há 45 dias/)).toBeInTheDocument();
  });

  it("sem nenhuma conta parada, não mostra o alerta", async () => {
    mockFunnel({
      aberta: 1,
      pre_faturada: 0,
      faturada: 0,
      em_auditoria: 1,
      glosada_parcial: 0,
      fechada: 0,
      cancelada: 0,
      stale_em_auditoria_count: 0,
      oldest_em_auditoria_age_days: null,
    });

    renderWithProviders(<ContaStatusFunnelPanel />);

    await screen.findByText("Contas");
    expect(screen.queryByText(/parada.*em auditoria/)).not.toBeInTheDocument();
  });

  it("não tem violações de acessibilidade", async () => {
    mockFunnel({
      aberta: 3,
      pre_faturada: 1,
      faturada: 5,
      em_auditoria: 2,
      glosada_parcial: 0,
      fechada: 10,
      cancelada: 1,
      stale_em_auditoria_count: 2,
      oldest_em_auditoria_age_days: 45,
    });

    const { container } = renderWithProviders(<ContaStatusFunnelPanel />);

    await screen.findByText("Aberta");
    await expectNoA11yViolations(container);
  });
});
