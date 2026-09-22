import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { SimuladorPanel } from "@/components/dashboard/SimuladorPanel";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import { expectNoA11yViolations } from "@/test/a11y";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

describe("SimuladorPanel", () => {
  it("projeta o impacto combinando denial_at_risk_value e estimated_revenue_at_risk reais, nunca um número inventado", async () => {
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url.includes("executive-summary")) {
        return Promise.resolve({ denial_at_risk_value: 10_000 } as never);
      }
      if (url.includes("agenda-metrics")) {
        return Promise.resolve({ estimated_revenue_at_risk: 2_000 } as never);
      }
      if (url.includes("network-benchmark")) {
        return Promise.resolve({ metrics: [], window_days: 90 } as never);
      }
      throw new Error(`URL inesperada: ${url}`);
    });

    renderWithProviders(<SimuladorPanel />);

    // Valores default: 40% do buraco de glosa + 20% do risco de falta
    // = 0.4*10000 + 0.2*2000 = 4000 + 400 = 4400.
    await waitFor(() => expect(screen.getByText(/R\$\s?4\.400,00/)).toBeInTheDocument());
  });

  it("sem comparativo de rede disponível, não mostra o botão de cenário recomendado", async () => {
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url.includes("executive-summary")) return Promise.resolve({ denial_at_risk_value: 10_000 } as never);
      if (url.includes("agenda-metrics")) return Promise.resolve({ estimated_revenue_at_risk: 2_000 } as never);
      if (url.includes("network-benchmark")) return Promise.resolve({ metrics: [], window_days: 90 } as never);
      throw new Error(`URL inesperada: ${url}`);
    });

    renderWithProviders(<SimuladorPanel />);

    await waitFor(() => expect(screen.getByText("Ajuste os cenários")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /cenário recomendado/i })).not.toBeInTheDocument();
  });

  it("cenário recomendado preenche os sliders com a redução até a mediana de rede", async () => {
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url.includes("executive-summary")) return Promise.resolve({ denial_at_risk_value: 10_000 } as never);
      if (url.includes("agenda-metrics")) return Promise.resolve({ estimated_revenue_at_risk: 2_000 } as never);
      if (url.includes("network-benchmark")) {
        return Promise.resolve({
          window_days: 90,
          metrics: [
            { key: "denial", label: "Taxa de glosa", your_rate: 0.4, your_sample: 20, network_median: 0.1, cohort_size: 5 },
            { key: "no_show", label: "Taxa de falta", your_rate: 0.2, your_sample: 20, network_median: 0.1, cohort_size: 5 },
          ],
        } as never);
      }
      throw new Error(`URL inesperada: ${url}`);
    });

    renderWithProviders(<SimuladorPanel />);

    const button = await screen.findByRole("button", { name: /cenário recomendado/i });
    fireEvent.click(button);

    // Glosa: (0.4-0.1)/0.4 = 75%. Falta: (0.2-0.1)/0.2 = 50%.
    await waitFor(() => expect(screen.getByLabelText("Reduzir valor em risco de glosa")).toHaveValue("75"));
    expect(screen.getByLabelText("Reduzir valor em risco de falta")).toHaveValue("50");
  });

  // "Junta Técnica Insighta" (reavaliação de mercado da Sala de Comando):
  // "a maioria de quem abriria o Simulador não tem hipótese pronta pra
  // testar — precisa de sugestão, não de slider em branco". Os sliders
  // agora chegam PRÉ-CARREGADOS com o cenário recomendado, sem exigir
  // clique no botão.
  it("pré-carrega os sliders com o cenário recomendado, sem precisar clicar no botão", async () => {
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url.includes("executive-summary")) return Promise.resolve({ denial_at_risk_value: 10_000 } as never);
      if (url.includes("agenda-metrics")) return Promise.resolve({ estimated_revenue_at_risk: 2_000 } as never);
      if (url.includes("network-benchmark")) {
        return Promise.resolve({
          window_days: 90,
          metrics: [
            { key: "denial", label: "Taxa de glosa", your_rate: 0.4, your_sample: 20, network_median: 0.1, cohort_size: 5 },
            { key: "no_show", label: "Taxa de falta", your_rate: 0.2, your_sample: 20, network_median: 0.1, cohort_size: 5 },
          ],
        } as never);
      }
      throw new Error(`URL inesperada: ${url}`);
    });

    renderWithProviders(<SimuladorPanel />);

    // Glosa: (0.4-0.1)/0.4 = 75%. Falta: (0.2-0.1)/0.2 = 50% — sem
    // clicar em nenhum botão.
    await waitFor(() => expect(screen.getByLabelText("Reduzir valor em risco de glosa")).toHaveValue("75"));
    expect(screen.getByLabelText("Reduzir valor em risco de falta")).toHaveValue("50");
  });

  it("não sobrescreve um ajuste manual do usuário depois que ele mexe num slider", async () => {
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url.includes("executive-summary")) return Promise.resolve({ denial_at_risk_value: 10_000 } as never);
      if (url.includes("agenda-metrics")) return Promise.resolve({ estimated_revenue_at_risk: 2_000 } as never);
      if (url.includes("network-benchmark")) {
        return Promise.resolve({
          window_days: 90,
          metrics: [{ key: "denial", label: "Taxa de glosa", your_rate: 0.4, your_sample: 20, network_median: 0.1, cohort_size: 5 }],
        } as never);
      }
      throw new Error(`URL inesperada: ${url}`);
    });

    renderWithProviders(<SimuladorPanel />);

    await waitFor(() => expect(screen.getByLabelText("Reduzir valor em risco de glosa")).toHaveValue("75"));
    fireEvent.change(screen.getByLabelText("Reduzir valor em risco de glosa"), { target: { value: "10" } });
    expect(screen.getByLabelText("Reduzir valor em risco de glosa")).toHaveValue("10");
  });

  it("não tem violações de acessibilidade", async () => {
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url.includes("executive-summary")) return Promise.resolve({ denial_at_risk_value: 10_000 } as never);
      if (url.includes("agenda-metrics")) return Promise.resolve({ estimated_revenue_at_risk: 2_000 } as never);
      if (url.includes("network-benchmark")) {
        return Promise.resolve({
          window_days: 90,
          metrics: [
            { key: "denial", label: "Taxa de glosa", your_rate: 0.4, your_sample: 20, network_median: 0.1, cohort_size: 5 },
            { key: "no_show", label: "Taxa de falta", your_rate: 0.2, your_sample: 20, network_median: 0.1, cohort_size: 5 },
          ],
        } as never);
      }
      throw new Error(`URL inesperada: ${url}`);
    });

    const { container } = renderWithProviders(<SimuladorPanel />);

    await waitFor(() => expect(screen.getByText(/R\$\s?4\.400,00/)).toBeInTheDocument());
    await expectNoA11yViolations(container);
  });
});
