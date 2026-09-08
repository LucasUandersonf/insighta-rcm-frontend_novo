import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { NetworkBenchmarkPanel } from "@/components/dashboard/NetworkBenchmarkPanel";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import type { NetworkBenchmark } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

describe("NetworkBenchmarkPanel", () => {
  it("mostra sua taxa e a mediana da rede quando o cohort é suficiente", async () => {
    const data: NetworkBenchmark = {
      window_days: 90,
      metrics: [
        { key: "denial", label: "Taxa de glosa", your_rate: 0.09, your_sample: 40, network_median: 0.05, cohort_size: 8 },
      ],
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<NetworkBenchmarkPanel />);

    await waitFor(() => expect(screen.getByText(/Você — 9\.0%/)).toBeInTheDocument());
    expect(screen.getByText(/Mediana 5\.0%/)).toBeInTheDocument();
    expect(screen.getByText(/acima da mediana/)).toBeInTheDocument();
  });

  it("mostra aviso honesto de amostra insuficiente, nunca uma mediana inventada", async () => {
    const data: NetworkBenchmark = {
      window_days: 90,
      metrics: [
        { key: "denial", label: "Taxa de glosa", your_rate: 0.09, your_sample: 40, network_median: null, cohort_size: 2 },
      ],
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<NetworkBenchmarkPanel />);

    await waitFor(() => expect(screen.getByText(/ainda não há clínicas suficientes/i)).toBeInTheDocument());
    expect(screen.queryByText(/Mediana/)).not.toBeInTheDocument();
  });
});
