import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { DataFreshnessBanner } from "@/components/dashboard/DataFreshnessBanner";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import { expectNoA11yViolations } from "@/test/a11y";
import type { DataFreshness } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

function isoHoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

describe("DataFreshnessBanner", () => {
  it("não renderiza nada quando nenhuma ingestão foi bem-sucedida ainda", async () => {
    const empty: DataFreshness = { items: [], stalest_at: null };
    vi.mocked(apiClient.get).mockResolvedValue(empty);

    renderWithProviders(<DataFreshnessBanner />);

    await waitFor(() => expect(apiClient.get).toHaveBeenCalled());
    expect(screen.queryByText(/Dado mais antigo importado/)).not.toBeInTheDocument();
  });

  it("mostra o tipo de dado e o horário relativo de cada ingestão recente, sem tom de alerta", async () => {
    const data: DataFreshness = {
      items: [
        { data_type: "faturamento", last_ingested_at: isoHoursAgo(1) },
        { data_type: "agenda", last_ingested_at: isoHoursAgo(2) },
      ],
      stalest_at: isoHoursAgo(2),
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    const { container } = renderWithProviders(<DataFreshnessBanner />);

    await waitFor(() => expect(screen.getByText(/Faturamento: há 1h/)).toBeInTheDocument());
    expect(screen.getByText(/Agenda: há 2h/)).toBeInTheDocument();
    expect(screen.getByText(/Dado mais antigo importado há 2h/)).toBeInTheDocument();
    expect(container.firstChild).not.toHaveClass("text-pending");
    await expectNoA11yViolations(container);
  });

  it("usa o tom de alerta quando o dado mais antigo passou de 3 dias", async () => {
    const data: DataFreshness = {
      items: [{ data_type: "glosa", last_ingested_at: isoHoursAgo(24 * 5) }],
      stalest_at: isoHoursAgo(24 * 5),
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    const { container } = renderWithProviders(<DataFreshnessBanner />);

    await waitFor(() => expect(screen.getByText(/Glosa: há 5 dias/)).toBeInTheDocument());
    expect(container.firstChild).toHaveClass("text-pending");
  });

  it("rotula um data_type desconhecido pelo próprio valor cru, nunca some silenciosamente", async () => {
    const data: DataFreshness = {
      items: [{ data_type: "prontuario", last_ingested_at: isoHoursAgo(1) }],
      stalest_at: isoHoursAgo(1),
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<DataFreshnessBanner />);

    await waitFor(() => expect(screen.getByText(/prontuario: há 1h/)).toBeInTheDocument());
  });
});
