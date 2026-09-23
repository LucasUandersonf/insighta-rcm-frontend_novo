import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { NoShowAccuracyCard, calibrationNote } from "@/components/dashboard/NoShowAccuracyCard";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import type { NoShowAccuracy } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

function accuracy(overrides: Partial<NoShowAccuracy> = {}): NoShowAccuracy {
  return {
    window_days: 90,
    evaluated: 180,
    no_shows: 30,
    flagged_no_shows: 25,
    hit_rate: 25 / 30,
    lift: 10,
    by_level: [
      { risk_level: "baixo", appointments: 100, no_shows: 5, no_show_rate: 0.05 },
      { risk_level: "medio", appointments: 50, no_shows: 10, no_show_rate: 0.2 },
      { risk_level: "alto", appointments: 30, no_shows: 15, no_show_rate: 0.5 },
    ],
    low_threshold: 0.08,
    medium_threshold: 0.22,
    calibration_status: "auto",
    calibrated_at: "2026-09-20T10:00:00Z",
    history_days: 200,
    days_until_calibration: 0,
    ...overrides,
  };
}

describe("NoShowAccuracyCard", () => {
  it("mostra das faltas quantas estavam sinalizadas e a origem dos cortes", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(accuracy());
    renderWithProviders(<NoShowAccuracyCard />);

    expect(await screen.findByText("83%")).toBeInTheDocument();
    expect(screen.getByText(/Das 30 faltas, 25 estavam sinalizadas/)).toBeInTheDocument();
    expect(screen.getByText(/risco alto falta 10,0× mais/)).toBeInTheDocument();
    expect(screen.getByText(/calibrados com o histórico da sua clínica em 20\/09/)).toBeInTheDocument();
    expect(screen.getByText("faltou 50% de 30")).toBeInTheDocument();
  });

  it("sem faltas previstas ainda, explica em vez de mostrar 0%", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(
      accuracy({ no_shows: 0, flagged_no_shows: 0, hit_rate: null, lift: null, calibration_status: "aprendendo", days_until_calibration: 42 })
    );
    renderWithProviders(<NoShowAccuracyCard />);

    expect(await screen.findByText(/Ainda não há faltas com previsão registrada/)).toBeInTheDocument();
    expect(screen.getByText(/faltam 42 dias de histórico/)).toBeInTheDocument();
  });

  it("descreve ajuste manual e cortes padrão", () => {
    expect(calibrationNote(accuracy({ calibration_status: "manual" }))).toMatch(/ajustados manualmente em Minha Clínica/);
    expect(calibrationNote(accuracy({ calibration_status: "padrao", low_threshold: 0.1, medium_threshold: 0.3 }))).toMatch(
      /Cortes padrão \(baixo abaixo de 10%, alto a partir de 30%\)/
    );
  });
});
