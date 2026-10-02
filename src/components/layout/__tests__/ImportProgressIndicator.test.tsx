import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { ImportProgressIndicator } from "@/components/layout/ImportProgressIndicator";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

const upload = (overrides: Record<string, unknown>) => ({
  upload_id: "u1",
  error: null,
  ingestion_file_id: null,
  row_count: null,
  error_row_count: null,
  original_filename: "faturamento-2025.xlsx",
  data_type: "faturamento",
  processed_rows: 0,
  total_rows: null,
  ...overrides,
});

describe("ImportProgressIndicator", () => {
  it("mostra a importação em andamento em qualquer tela e avisa quando termina", async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce([upload({ status: "processando", processed_rows: 30000, total_rows: 120000 })] as never)
      .mockResolvedValue([upload({ status: "processado", row_count: 120000, error_row_count: 3, ingestion_file_id: "f1" })] as never);

    renderWithProviders(<ImportProgressIndicator />, { route: "/inicio" });

    const pill = await screen.findByRole("status");
    expect(pill).toHaveTextContent("Importando faturamento-2025.xlsx — 25%");
    expect(pill.closest("a")).toHaveAttribute("href", "/upload");

    // Próxima consulta (a cada 2 s enquanto há algo em andamento): terminou.
    await waitFor(() => expect(screen.getByText(/faturamento-2025.xlsx importado: 120000 linha\(s\) lida\(s\), 3 rejeitada\(s\)/)).toBeInTheDocument(), {
      timeout: 4000,
    });
    expect(screen.queryByRole("status", { name: /Importando/ })).not.toBeInTheDocument();
  });

  it("sem importação em andamento não mostra nada", async () => {
    vi.mocked(apiClient.get).mockResolvedValue([] as never);
    const { container } = renderWithProviders(<ImportProgressIndicator />, { route: "/inicio" });
    await waitFor(() => expect(apiClient.get).toHaveBeenCalled());
    expect(container.textContent).toBe("");
  });
});
