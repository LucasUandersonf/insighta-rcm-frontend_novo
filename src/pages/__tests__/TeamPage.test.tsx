import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TeamPage } from "@/pages/TeamPage";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/context/AuthContext";
import { renderWithProviders } from "@/test/utils";
import { expectNoA11yViolations } from "@/test/a11y";
import type { CurrentUser } from "@/lib/types";
import type { Demand, TeamOverview } from "@/lib/team";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn(), post: vi.fn() } };
});
vi.mock("@/context/AuthContext", () => ({ useAuth: vi.fn() }));

function mockUser(role: CurrentUser["role"]) {
  vi.mocked(useAuth).mockReturnValue({ user: { tenant_id: "t1", sub: "u1", role } } as unknown as ReturnType<typeof useAuth>);
}

const yesterday = new Date(Date.now() - 86400000);
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function demand(over: Partial<Demand>): Demand {
  return {
    id: "d",
    title: "",
    message: "Mensagem",
    category: "faturamento",
    severity: "critical",
    financial_impact: 1000,
    sector: "faturamento",
    sector_label: "Faturamento",
    status: "pendente",
    status_label: "Nova",
    is_overdue: false,
    coordinator: { id: "c1", full_name: "Rafael Souza" },
    assigned_by: { id: "g1", full_name: "Marina Souza" },
    manager_note: null,
    due_date: null,
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
    ...over,
  };
}

const DEMANDS: Demand[] = [
  demand({ id: "d1", title: "Recorrer das 11 guias Unimed com prazo", status: "em_andamento", status_label: "Em andamento", is_overdue: true, due_date: iso(yesterday), started_at: new Date(Date.now() - 3 * 86400000).toISOString() }),
  demand({
    id: "d2",
    title: "Segunda-feira está com menos consultas marcadas",
    sector: "agendamento",
    sector_label: "Agendamento",
    status: "em_andamento",
    status_label: "Em andamento",
    coordinator: { id: "c2", full_name: "Carla Mendes" },
    last_update_note: "Liguei para 9 dos 14 pacientes; 6 remarcaram para segunda.",
    last_update_at: new Date(Date.now() - 2 * 3600000).toISOString(),
  }),
  demand({
    id: "d3",
    title: "O marketing está gastando mais do que está trazendo de volta",
    status: "devolvido",
    status_label: "Devolvida",
    returned_reason: "outro_setor",
    returned_reason_label: "Não é do meu setor",
    returned_note: "Quem decide o gasto é a gestão.",
    returned_at: new Date().toISOString(),
  }),
  demand({ id: "d4", title: "Quinta-feira com horários vagos", status: "resolvido", status_label: "Resolvida", resolved_at: new Date().toISOString(), confirmation: "confirmado", resolution_note: "Encaixei a lista de espera." }),
];

const OVERVIEW: TeamOverview = {
  open_count: 2,
  overdue_count: 1,
  resolved_month: 1,
  returned_count: 1,
  recovered_month: 18400,
  open_by_sector: { Faturamento: 1, Agendamento: 1 },
  scoreboard: [
    {
      coordinator: { id: "c2", full_name: "Carla Mendes" },
      sectors: ["Agendamento"],
      open_count: 1,
      overdue_count: 0,
      resolved_count: 7,
      on_time_pct: 86,
      confirmed_count: 5,
      evaluated_count: 6,
      avg_days_to_resolve: 1.8,
      recovered_value: 6100,
    },
  ],
  updates: [{ demand_id: "d4", kind: "confirmado", text: "Carla Mendes resolveu “Quinta-feira com horários vagos” — confirmado pelos dados: o problema sumiu.", at: new Date().toISOString() }],
};

beforeEach(() => {
  vi.mocked(apiClient.get).mockImplementation((url: string) => {
    if (url.includes("/team/overview")) return Promise.resolve(OVERVIEW as never);
    if (url.includes("/team/demands")) return Promise.resolve(DEMANDS as never);
    if (url.includes("/team/me")) return Promise.resolve({ profile: "gestor", sectors: [] } as never);
    return Promise.reject(new Error(`sem mock para ${url}`));
  });
  vi.mocked(apiClient.post).mockResolvedValue(DEMANDS[0] as never);
});

describe("TeamPage (canvas Equipe)", () => {
  it("mostra aviso, resumo em frases, placar por coordenador e demandas", async () => {
    mockUser("owner");
    renderWithProviders(<TeamPage />);

    expect(await screen.findByRole("heading", { name: "Equipe" })).toBeInTheDocument();
    expect(screen.getByText(/Carla Mendes resolveu “Quinta-feira com horários vagos”/)).toBeInTheDocument();
    expect(screen.getByText("1 com o Faturamento e 1 com o Agendamento.")).toBeInTheDocument();
    expect(screen.getByText("No Faturamento.")).toBeInTheDocument();
    expect(screen.getByText("1 já confirmada pelos dados.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Metas resolvidas por coordenador" })).toBeInTheDocument();
    expect(screen.getByText("5 de 6")).toBeInTheDocument();
    expect(screen.getByText("86%")).toBeInTheDocument();
    expect(screen.getByText("Carla, há 2 h: “Liguei para 9 dos 14 pacientes; 6 remarcaram para segunda.”")).toBeInTheDocument();
    expect(screen.getByText("Sem atualização há 3 dias.")).toBeInTheDocument();
    expect(screen.getByText(/Não é do meu setor:/)).toBeInTheDocument();
  });

  it("gestor cobra a demanda atrasada e encerra a devolvida", async () => {
    mockUser("owner");
    renderWithProviders(<TeamPage />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Cobrar" }));
    expect(apiClient.post).toHaveBeenCalledWith("/api/v1/team/demands/d1/nudge");
    await user.click(screen.getByRole("button", { name: "Encerrar" }));
    expect(apiClient.post).toHaveBeenCalledWith("/api/v1/team/demands/d3/close");
  });

  it("auditor vê tudo mas não tem botões de ação", async () => {
    mockUser("auditor");
    renderWithProviders(<TeamPage />);
    expect(await screen.findByRole("heading", { name: "Equipe" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cobrar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reatribuir" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ok, visto" })).not.toBeInTheDocument();
  });

  it("aba Resolvidas mostra o que foi feito", async () => {
    mockUser("owner");
    renderWithProviders(<TeamPage />, { route: "/equipe?tab=resolvidas" });
    const list = await screen.findByRole("region", { name: "Demandas" }).catch(() => null);
    const scope = list ? within(list) : screen;
    expect(await scope.findByText(/Rafael: “Encaixei a lista de espera.” Confirmado pelos dados./)).toBeInTheDocument();
  });

  it("não tem violações de acessibilidade", async () => {
    mockUser("owner");
    const { container } = renderWithProviders(<TeamPage />);
    await screen.findByRole("heading", { name: "Equipe" });
    await expectNoA11yViolations(container);
  });
});
