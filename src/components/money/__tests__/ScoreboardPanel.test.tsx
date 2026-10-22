import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { ScoreboardPanel } from "@/components/money/ScoreboardPanel";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import type { Scoreboard } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { sub: "u1", tenant_id: "t1", role: "owner" } }),
}));

const BOARD: Scoreboard = {
  window_days: 90,
  min_events: 10,
  no_show: { ready: false, events: 4, flagged: 3, hit_rate: 0.75, high_rate: 1, low_rate: 0.14 },
  denial: { ready: true, events: 12, flagged: 9, hit_rate: 0.75, high_rate: 1, low_rate: 0.25 },
  cash_weeks: [{ week_start: "2026-10-12", predicted: 1000, actual: 900 }],
  cash_accuracy: 0.9,
};

describe("ScoreboardPanel", () => {
  it("mostra acerto de glosa, caixa e 'aprendendo' sem amostra", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(BOARD as never);
    renderWithProviders(<ScoreboardPanel />);
    expect(await screen.findByText("Placar de acerto")).toBeInTheDocument();
    expect(screen.getByText("Aprendendo")).toBeInTheDocument();
    expect(screen.getByText(/4 de 10 faltas resolvidas/)).toBeInTheDocument();
    expect(screen.getByText(/Das 12 glosas, 9 tinham risco no envio\. Conta de risco alto foi glosada 4× mais que a de risco baixo\./)).toBeInTheDocument();
    expect(screen.getByText("90%")).toBeInTheDocument();
    expect(screen.getByText(/previsto R\$\s?1\.000,00, entrou R\$\s?900,00/)).toBeInTheDocument();
  });

  it("glosa sem nenhuma conta marcada como risco fica em 'Aprendendo'", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      ...BOARD,
      denial: { ...BOARD.denial, scored: false, ready: false, hit_rate: 0, flagged: 0 },
    } as never);
    renderWithProviders(<ScoreboardPanel />);
    expect(await screen.findByText(/Nenhuma glosa foi marcada como risco ainda/)).toBeInTheDocument();
    expect(screen.queryByText("0%")).not.toBeInTheDocument();
  });
});
