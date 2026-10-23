import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResultStatementPage, recentMonths } from "@/pages/ResultStatementPage";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import { expectNoA11yViolations } from "@/test/a11y";
import type { ResultStatement } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn(), getBlob: vi.fn() } };
});

function statement(overrides: Partial<ResultStatement> = {}): ResultStatement {
  return {
    month: "2026-10",
    period_start: "2026-10-01",
    period_end: "2026-10-31",
    is_partial: true,
    total_value: 880,
    previous_month_total: 500,
    components: [
      { key: "saved_before_submission", label: "Salvo antes do envio", value: 30, count: 1, how: "Regra do salvo." },
      { key: "appeals_won", label: "Recursos de glosa ganhos", value: 150, count: 1, how: "Regra do recurso." },
      { key: "realized_outcomes", label: "Insights resolvidos com ganho medido", value: 700, count: 1, how: "Regra do insight." },
    ],
    items: [{ kind: "outcome", title: "Agenda de terça ociosa", detail: "Resolvido por Ana", value: 700, at: null }],
    plan_price: 800,
    plan_price_source: "referencia",
    return_multiple: 1.1,
    cumulative_total: 1380,
    tracking_since: "2026-09-01",
    ...overrides,
  };
}

describe("ResultStatementPage", () => {
  it("mostra o total, o múltiplo sobre o preço, a composição e os itens", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(statement() as never);
    const { container } = renderWithProviders(<ResultStatementPage />);

    expect(await screen.findByText(/R\$\s?880,00/)).toBeInTheDocument();
    expect(screen.getByText(/o preço Founders \(referência\)/)).toBeInTheDocument();
    expect(screen.getByText("Salvo antes do envio")).toBeInTheDocument();
    expect(screen.getByText("Recursos de glosa ganhos")).toBeInTheDocument();
    expect(screen.getByText("Agenda de terça ociosa")).toBeInTheDocument();
    expect(screen.getByText("Resolvido por Ana")).toBeInTheDocument();
    expect(screen.getByText(/mês em andamento/)).toBeInTheDocument();
    expect(screen.getAllByText("Como calculamos")).toHaveLength(3);
    await expectNoA11yViolations(container);
  });

  it("troca de mês e pede o extrato do mês escolhido", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(statement() as never);
    renderWithProviders(<ResultStatementPage />);
    await screen.findByText("Agenda de terça ociosa");
    const previous = recentMonths()[1];
    await userEvent.selectOptions(screen.getByLabelText("Mês"), previous);
    expect(vi.mocked(apiClient.get)).toHaveBeenLastCalledWith(`/api/v1/analytics/result-statement?month=${previous}`);
  });

  it("sem resultado medido, explica como o valor passa a aparecer", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(statement({ total_value: 0, items: [], return_multiple: null }) as never);
    renderWithProviders(<ResultStatementPage />);
    expect(await screen.findByText(/Nenhum resultado medido neste mês ainda/)).toBeInTheDocument();
    expect(screen.queryByText(/o preço Founders/)).not.toBeInTheDocument();
  });

  it("baixa o Board Pack do mês para a reunião de sócios", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(statement() as never);
    vi.mocked(apiClient.getBlob).mockResolvedValue(new Blob(["%PDF"]) as never);
    Object.assign(URL, { createObjectURL: vi.fn(() => "blob:x"), revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    renderWithProviders(<ResultStatementPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Board Pack" }));
    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(vi.mocked(apiClient.getBlob).mock.calls[0][0]).toMatch(/^\/api\/v1\/analytics\/board-pack\/pdf\?month=\d{4}-\d{2}$/);
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toMatch(/^board_pack_\d{4}-\d{2}\.pdf$/);
  });

  it("recentMonths devolve 12 meses do atual para trás", () => {
    const months = recentMonths(new Date(2026, 0, 15));
    expect(months).toHaveLength(12);
    expect(months[0]).toBe("2026-01");
    expect(months[1]).toBe("2025-12");
  });
});
