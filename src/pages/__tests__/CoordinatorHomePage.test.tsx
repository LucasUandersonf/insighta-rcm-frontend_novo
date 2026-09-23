import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CoordinatorHomePage } from "@/pages/CoordinatorHomePage";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import { expectNoA11yViolations } from "@/test/a11y";
import type { CoordinatorSummary, Demand } from "@/lib/team";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn(), post: vi.fn() } };
});

const today = new Date();
const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

const base = {
  message: "A segunda tem 31% menos agendamentos que a média das últimas 8 semanas.",
  category: "agenda",
  severity: "warning",
  financial_impact: 4200,
  sector: "agendamento",
  sector_label: "Agendamento",
  is_overdue: false,
  coordinator: { id: "u1", full_name: "Carla Mendes" },
  assigned_by: { id: "g1", full_name: "Marina Souza" },
  created_at: new Date().toISOString(),
  started_at: null,
  resolved_at: null,
  resolution_note: null,
  returned_reason: null,
  returned_reason_label: null,
  returned_note: null,
  returned_at: null,
  last_update_note: null,
  last_update_at: null,
  nudged_at: null,
  confirmation: null,
} as const;

const DEMANDS = [
  { ...base, id: "d1", title: "Segunda-feira está com menos consultas marcadas", status: "pendente", status_label: "Nova", due_date: iso, manager_note: "Priorize os pacientes de alto valor e use a lista de espera." },
  { ...base, id: "d2", title: "Tem gente com boa chance de não aparecer nos próximos dias", status: "em_andamento", status_label: "Em andamento", due_date: null, manager_note: null },
] as unknown as Demand[];

const SUMMARY: CoordinatorSummary = {
  profile: "coordenador",
  sectors: [{ sector: "agendamento", label: "Agendamento", coordinator: { id: "u1", full_name: "Carla Mendes" }, is_mine: true }],
  open_count: 2,
  due_today_count: 1,
  in_progress_count: 1,
  awaiting_confirmation_count: 0,
  score: null,
  radar: [{ title: "Quem agenda por WhatsApp falta mais", message: "Falta de 18% contra 9% nos outros canais.", severity: "warning", financial_impact: null }],
};

beforeEach(() => {
  vi.mocked(apiClient.get).mockImplementation((url: string) => {
    if (url.includes("/team/my-summary")) return Promise.resolve(SUMMARY as never);
    if (url.includes("/team/demands")) return Promise.resolve(DEMANDS as never);
    if (url.includes("users/me")) return Promise.resolve({ id: "u1", full_name: "Carla Mendes" } as never);
    if (url.includes("today-agenda"))
      return Promise.resolve({ date: iso, headline: "42 consultas, manhã cheia e 3 buracos à tarde.", total_appointments: 42, periods: [], waitlist_waiting: 6 } as never);
    return Promise.reject(new Error(`sem mock para ${url}`));
  });
  vi.mocked(apiClient.post).mockResolvedValue(DEMANDS[1] as never);
});

describe("CoordinatorHomePage (canvas Coordenador)", () => {
  it("mostra só as demandas do setor, o placar e o radar", async () => {
    renderWithProviders(<CoordinatorHomePage />);
    expect(await screen.findByText(/, Carla/)).toBeInTheDocument();
    expect(screen.getByText("Coordenação de Agendamento")).toBeInTheDocument();
    expect(screen.getByText("Você tem 2 demandas abertas — 1 vence hoje. Tudo aqui é do seu setor.")).toBeInTheDocument();
    expect(screen.getByText("Vence hoje")).toBeInTheDocument();
    expect(screen.getByText(/Priorize os pacientes de alto valor/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Seu placar do mês" })).toBeInTheDocument();
    expect(screen.getByText("Quem agenda por WhatsApp falta mais")).toBeInTheDocument();
    expect(await screen.findByText("42 consultas, manhã cheia e 3 buracos à tarde.")).toBeInTheDocument();
  });

  it("começa, resolve com o que foi feito e devolve com motivo", async () => {
    renderWithProviders(<CoordinatorHomePage />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Começar" }));
    expect(apiClient.post).toHaveBeenCalledWith("/api/v1/team/demands/d1/start");

    await user.click(screen.getByRole("button", { name: "Marcar como resolvida" }));
    await user.type(screen.getByLabelText("O que foi feito?"), "Mandei lembrete para os 9 pacientes; 7 confirmaram.");
    await user.click(screen.getByRole("button", { name: "Confirmar resolução" }));
    expect(apiClient.post).toHaveBeenCalledWith("/api/v1/team/demands/d2/resolve", { note: "Mandei lembrete para os 9 pacientes; 7 confirmaram." });
    expect(await screen.findByText(/A gestão já recebeu o aviso na Home/)).toBeInTheDocument();
  });

  it("devolver exige motivo e explicação", async () => {
    renderWithProviders(<CoordinatorHomePage />);
    const user = userEvent.setup();
    const buttons = await screen.findAllByRole("button", { name: "Devolver" });
    await user.click(buttons[1]!);
    await user.click(screen.getByRole("button", { name: "Preciso de mais prazo" }));
    const submit = screen.getByRole("button", { name: "Devolver para Marina" });
    expect(submit).toBeDisabled();
    await user.type(screen.getByLabelText("Explique para a gestão"), "Preciso até segunda.");
    await user.click(submit);
    expect(apiClient.post).toHaveBeenCalledWith("/api/v1/team/demands/d2/return", { reason: "mais_prazo", note: "Preciso até segunda." });
  });

  it("não tem violações de acessibilidade", async () => {
    const { container } = renderWithProviders(<CoordinatorHomePage />);
    await screen.findByText("Suas demandas");
    await expectNoA11yViolations(container);
  });
});
