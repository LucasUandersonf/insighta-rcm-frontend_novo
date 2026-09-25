import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HomePage } from "@/pages/HomePage";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/context/AuthContext";
import { renderWithProviders } from "@/test/utils";
import type { CurrentUser, ExecutiveNarrative, PlatformUser } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn(), post: vi.fn() } };
});

vi.mock("@/context/AuthContext", () => ({ useAuth: vi.fn() }));

const navigateMock = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigateMock };
});

const PROFILE: PlatformUser = { id: "u1", full_name: "Marina Souza", email: "marina@clinica.com" } as PlatformUser;

function mockUser(role: CurrentUser["role"] = "owner") {
  vi.mocked(useAuth).mockReturnValue({ user: { tenant_id: "t1", sub: "u1", role } } as unknown as ReturnType<typeof useAuth>);
}

// Achado ALTO da Auditoria de Prontidão v1 ("sem wizard de tenant novo")
// — ingestionTotal>0 por padrão aqui, pra nenhum teste pré-existente
// cair sem querer no estado de primeiro uso; os testes DEDICADOS a ele
// passam ingestionTotal=0 explicitamente.
function mockEndpoints(narrative: ExecutiveNarrative, ingestionTotal = 5) {
  mockUser();
  vi.mocked(apiClient.get).mockImplementation((url: string) => {
    if (url.includes("executive-narrative")) return Promise.resolve(narrative as never);
    if (url.includes("users/me")) return Promise.resolve(PROFILE as never);
    if (url.includes("ingestion/files")) return Promise.resolve({ items: [], total: ingestionTotal, limit: 1, offset: 0 } as never);
    return Promise.reject(new Error(`unexpected url in test: ${url}`));
  });
}

describe("HomePage", () => {
  it("mostra o texto narrado pela IA e a saudação por nome", async () => {
    mockEndpoints({
      period_start: "2026-09-10",
      period_end: "2026-09-16",
      narrative: "A agenda de quinta está mais vazia que o normal — ainda dá pra reverter.",
      generated_at: "2026-09-16T08:00:00Z",
      top_priorities: [],
      recently_resolved: [],
    });

    renderWithProviders(<HomePage />);

    expect(await screen.findByText("A agenda de quinta está mais vazia que o normal — ainda dá pra reverter.")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { level: 1, name: /, Marina$/ })).toBeInTheDocument();
  });

  it("com o jornal da manhã pronto, mostra a manchete e a abertura escritas pela IA", async () => {
    mockEndpoints({
      period_start: "2026-09-10",
      period_end: "2026-09-16",
      narrative: "Abertura do jornal.",
      generated_at: null,
      top_priorities: [],
      recently_resolved: [],
      edition: {
        headline: "Mês forte, mas a Unimed pesa",
        lead: "A clínica faturou R$ 482.000 em 30 dias. A Unimed segue glosando acima do normal.",
        cards: { faturado: "R$ 482.000 em 30 dias, 6% acima do mês anterior." },
      },
    });

    renderWithProviders(<HomePage />);

    expect(await screen.findByText("Jornal da manhã")).toBeInTheDocument();
    expect(screen.getByText("Mês forte, mas a Unimed pesa")).toBeInTheDocument();
    expect(screen.getByText("A clínica faturou R$ 482.000 em 30 dias. A Unimed segue glosando acima do normal.")).toBeInTheDocument();
  });

  it("mostra até 3 cards de prioridade com botão de ação real", async () => {
    mockEndpoints({
      period_start: "2026-09-10",
      period_end: "2026-09-16",
      narrative: "Resumo do dia.",
      generated_at: "2026-09-16T08:00:00Z",
      top_priorities: [
        {
          severity: "critical",
          category: "faturamento",
          title: "Convênio recusando mais pagamentos",
          message: "...",
          financial_impact: 4200,
          action_label: "Ver faturamentos de alto risco",
          action_href: "/painel",
        },
      ],
      recently_resolved: [],
    });
    const user = userEvent.setup();

    renderWithProviders(<HomePage />);

    expect(await screen.findByText("Convênio recusando mais pagamentos")).toBeInTheDocument();
    // Canvas Redesign 2026: a manchete mostra "Resolver agora" (o rótulo
    // específico da ação fica no title do botão).
    const button = screen.getByRole("button", { name: "Resolver agora" });
    expect(button).toHaveAttribute("title", "Ver faturamentos de alto risco");
    await user.click(button);
    expect(navigateMock).toHaveBeenCalledWith("/painel");
  });

  it("destino '#id' de um card navega pra Sala de Comando já pedindo pra rolar até lá (Achado 2)", async () => {
    mockEndpoints({
      period_start: "2026-09-10",
      period_end: "2026-09-16",
      narrative: "Resumo do dia.",
      generated_at: "2026-09-16T08:00:00Z",
      top_priorities: [
        {
          severity: "warning",
          category: "agenda",
          title: "Agenda com mais horários vazios",
          message: "...",
          financial_impact: null,
          action_label: "Ver ocupação por profissional",
          action_href: "#agenda-resumo",
        },
      ],
      recently_resolved: [],
    });
    const user = userEvent.setup();

    renderWithProviders(<HomePage />);

    const button = await screen.findByRole("button", { name: "Resolver agora" });
    await user.click(button);
    expect(navigateMock).toHaveBeenCalledWith("/decisao?scrollTo=agenda-resumo");
  });

  it("destino '#tab:' de um card navega direto pra aba certa da Sala de Comando (Achado 2)", async () => {
    mockEndpoints({
      period_start: "2026-09-10",
      period_end: "2026-09-16",
      narrative: "Resumo do dia.",
      generated_at: "2026-09-16T08:00:00Z",
      top_priorities: [
        {
          severity: "warning",
          category: "faturamento",
          title: "No ritmo atual, a meta do ano não vai ser alcançada",
          message: "...",
          financial_impact: null,
          action_label: "Ver quem não voltou",
          action_href: "#tab:crm",
        },
      ],
      recently_resolved: [],
    });
    const user = userEvent.setup();

    renderWithProviders(<HomePage />);

    const button = await screen.findByRole("button", { name: "Resolver agora" });
    await user.click(button);
    expect(navigateMock).toHaveBeenCalledWith("/decisao?tab=crm");
  });

  it("destino '#weekday:'/'#professional:' de um card carrega o foco de agenda certo na Sala de Comando (Achado 2)", async () => {
    mockEndpoints({
      period_start: "2026-09-10",
      period_end: "2026-09-16",
      narrative: "Resumo do dia.",
      generated_at: "2026-09-16T08:00:00Z",
      top_priorities: [
        {
          severity: "warning",
          category: "agenda",
          title: "Quarta-feira está com menos consultas marcadas",
          message: "...",
          financial_impact: null,
          action_label: "Ver quem costumava vir quarta-feira",
          action_href: "#weekday:3",
        },
      ],
      recently_resolved: [],
    });
    const user = userEvent.setup();

    renderWithProviders(<HomePage />);

    const button = await screen.findByRole("button", { name: "Resolver agora" });
    await user.click(button);
    expect(navigateMock).toHaveBeenCalledWith("/decisao?weekday=3&scrollTo=agenda-resumo");
  });

  it("sem prioridades, mostra o estado 'tudo certo' em vez de nada", async () => {
    mockEndpoints({
      period_start: "2026-09-10",
      period_end: "2026-09-16",
      narrative: null,
      generated_at: null,
      top_priorities: [],
      recently_resolved: [],
    });

    renderWithProviders(<HomePage />);

    await waitFor(() => expect(apiClient.get).toHaveBeenCalled());
    expect(await screen.findByText("Nenhuma prioridade urgente agora — tudo dentro do esperado.")).toBeInTheDocument();
  });

  it("sem narrativa mas com prioridades reais, não afirma que está tudo tranquilo", async () => {
    // Achado 1 da Avaliação Home/Sala de Comando: antes, IA indisponível
    // (narrative=null) sempre mostrava "tudo tranquilo por aqui", mesmo
    // quando existiam prioridades reais logo abaixo — contradição visível
    // na mesma tela.
    mockEndpoints({
      period_start: "2026-09-10",
      period_end: "2026-09-16",
      narrative: null,
      generated_at: null,
      top_priorities: [
        {
          severity: "critical",
          category: "faturamento",
          title: "Convênio recusando mais pagamentos",
          message: "...",
          financial_impact: 4200,
          action_label: "Ver faturamentos de alto risco",
          action_href: "/painel",
        },
      ],
      recently_resolved: [],
    });

    renderWithProviders(<HomePage />);

    await screen.findByText("Convênio recusando mais pagamentos");
    expect(screen.queryByText(/Tudo tranquilo por aqui/)).not.toBeInTheDocument();
    expect(screen.getByText(/Aqui está o resumo de hoje/)).toBeInTheDocument();
  });

  it("rodapé 'Ir para a Sala de Comando' aponta pra /decisao", async () => {
    mockEndpoints({
      period_start: "2026-09-10",
      period_end: "2026-09-16",
      narrative: "Resumo do dia.",
      generated_at: "2026-09-16T08:00:00Z",
      top_priorities: [],
      recently_resolved: [],
    });
    renderWithProviders(<HomePage />);

    const link = await screen.findByRole("link", { name: /Ir para a Sala de Comando/ });
    expect(link).toHaveAttribute("href", "/decisao");
  });

  // Achado ALTO da Auditoria de Prontidão v1: tenant novo (zero arquivo
  // importado) caía no mesmo "Tudo tranquilo por aqui" de quem já opera
  // normalmente — sem nenhuma pista de que o primeiro passo é subir dado
  // na Central de Upload.
  describe("primeiro uso (tenant sem dado importado)", () => {
    it("owner vê os 3 passos: dados, coordenadores e saúde da conta", async () => {
      mockEndpoints(
        { period_start: "2026-09-10", period_end: "2026-09-16", narrative: null, generated_at: null, top_priorities: [], recently_resolved: [] },
        0
      );
      renderWithProviders(<HomePage />);

      expect(await screen.findByRole("link", { name: /Defina os coordenadores/ })).toHaveAttribute("href", "/admin/users");
      expect(screen.getByRole("link", { name: /Confira a saúde da conta/ })).toHaveAttribute("href", "/admin/saude-da-conta");
    });

    it("owner vê o convite pra Central de Upload em vez de 'tudo tranquilo'", async () => {
      mockEndpoints(
        { period_start: "2026-09-10", period_end: "2026-09-16", narrative: null, generated_at: null, top_priorities: [], recently_resolved: [] },
        0
      );
      const user = userEvent.setup();

      renderWithProviders(<HomePage />);

      expect(await screen.findByText(/Sua clínica ainda não tem dado importado/)).toBeInTheDocument();
      expect(screen.queryByText(/Tudo tranquilo por aqui/)).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Ir para Central de Upload" }));
      expect(navigateMock).toHaveBeenCalledWith("/upload");
    });

    it("atendimento (sem RBAC de upload) vê pedido pra avisar a equipe, sem botão que levaria a um 403", async () => {
      mockEndpoints(
        { period_start: "2026-09-10", period_end: "2026-09-16", narrative: null, generated_at: null, top_priorities: [], recently_resolved: [] },
        0
      );
      mockUser("atendimento");

      renderWithProviders(<HomePage />);

      expect(await screen.findByText(/Peça para o owner, administrador\(a\) ou financeiro/)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Ir para Central de Upload" })).not.toBeInTheDocument();
    });

    it("com dado importado (total>0), nunca mostra o convite de primeiro uso", async () => {
      mockEndpoints(
        { period_start: "2026-09-10", period_end: "2026-09-16", narrative: null, generated_at: null, top_priorities: [], recently_resolved: [] },
        5
      );

      renderWithProviders(<HomePage />);

      await waitFor(() => expect(apiClient.get).toHaveBeenCalled());
      expect(screen.queryByText(/Sua clínica ainda não tem dado importado/)).not.toBeInTheDocument();
    });
  });

  describe("Redesign 2026 — campos do canvas", () => {
    function mockFull(narrative: ExecutiveNarrative) {
      mockUser();
      vi.mocked(apiClient.get).mockImplementation((url: string) => {
        if (url.includes("executive-narrative")) return Promise.resolve(narrative as never);
        if (url.includes("users/me")) return Promise.resolve(PROFILE as never);
        if (url.includes("ingestion/files")) return Promise.resolve({ items: [], total: 5, limit: 1, offset: 0 } as never);
        if (url.includes("today-agenda"))
          return Promise.resolve({
            date: "2026-09-23",
            headline: "42 consultas, manhã cheia e 3 buracos à tarde.",
            total_appointments: 42,
            waitlist_waiting: 6,
            periods: [
              { label: "08–12h", text: "Tudo ocupado.", tone: "positive", action_label: null, action_href: null },
              { label: "12–18h", text: "3 horários vagos.", tone: "warning", action_label: "3 pessoas da lista de espera cabem neles.", action_href: "/waitlist" },
            ],
          } as never);
        if (url.includes("navigation-summary"))
          return Promise.resolve({
            module_alerts: [],
            my_open_insights: 0,
            last_import_at: null,
            last_import_source: null,
            urgent: { text: "Prazo para recorrer de 4 guias da Unimed termina amanhã — são R$ 9.200.", action_label: "Abrir recurso", action_href: "/denial-appeals" },
          } as never);
        return Promise.reject(new Error(`sem mock: ${url}`));
      });
    }

    const NARRATIVE: ExecutiveNarrative = {
      period_start: "2026-09-10",
      period_end: "2026-09-16",
      narrative: "Resumo do dia.",
      generated_at: "2026-09-16T08:00:00Z",
      top_priorities: [
        {
          severity: "critical",
          category: "faturamento",
          title: "A Unimed está recusando mais pagamentos que o normal",
          message: "A glosa saltou de 6% para 14%.",
          financial_impact: 28900,
          action_label: "Ver faturamentos de alto risco",
          action_href: "/painel",
          estimated_minutes: 20,
          why_now: "Está aberto há 2 dias.",
          what_to_do: "Ver faturamentos de alto risco.",
          if_ignored: "Continua em risco.",
        },
      ],
      recently_resolved: [],
    };

    it("mostra a tarja Urgente, a agenda de hoje por turno e o tempo estimado da manchete", async () => {
      mockFull(NARRATIVE);
      renderWithProviders(<HomePage />);

      expect(await screen.findByText("Prazo para recorrer de 4 guias da Unimed termina amanhã — são R$ 9.200.")).toBeInTheDocument();
      expect(await screen.findByText("42 consultas, manhã cheia e 3 buracos à tarde.")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "3 pessoas da lista de espera cabem neles." })).toHaveAttribute("href", "/waitlist");
      expect(screen.getByText(/Leva cerca de 20 minutos/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "atribuir a alguém" })).toBeInTheDocument();
    });

    it("sem retorno dos convênios no período, glosa e prazo zerados não viram boa notícia", async () => {
      mockFull(NARRATIVE);
      const base = vi.mocked(apiClient.get).getMockImplementation()!;
      const kpi = (value: number, previous: number) => ({ value, previous_value: previous, delta_pct: null });
      vi.mocked(apiClient.get).mockImplementation((url: string) => {
        if (url.includes("executive-summary"))
          return Promise.resolve({
            total_billed: kpi(219390, 222366),
            avg_days_to_receive: null,
            avg_capacity_utilization: null,
          } as never);
        if (url.includes("payer-overview"))
          return Promise.resolve({ total_billed: 219390, total_denied: 0, avg_days_to_receive: null, rows: [], verdicts: [], attention: [] } as never);
        return base(url);
      });
      renderWithProviders(<HomePage />);

      expect(await screen.findByText("Os convênios ainda não devolveram o retorno das cobranças deste período.")).toBeInTheDocument();
      expect(screen.getByText("Nenhum convênio pagou cobranças deste período ainda.")).toBeInTheDocument();
      expect(screen.queryByText("Nenhuma recusa de convênio no período.")).not.toBeInTheDocument();
      expect(screen.queryByText("Agenda ocupada")).not.toBeInTheDocument();
    });

    it("'Enviar por e-mail' manda o briefing para o próprio e-mail", async () => {
      mockFull(NARRATIVE);
      vi.mocked(apiClient.post).mockResolvedValue({ sent_to: "marina@clinica.com", delivered: true } as never);
      const user = userEvent.setup();
      renderWithProviders(<HomePage />);

      await user.click(await screen.findByRole("button", { name: /Enviar por e-mail/ }));
      expect(apiClient.post).toHaveBeenCalledWith("/api/v1/analytics/briefing/email", {});
      expect(await screen.findByText("Briefing enviado para marina@clinica.com.")).toBeInTheDocument();
    });

    it("'Comparar com' troca a janela do panorama", async () => {
      mockFull(NARRATIVE);
      const user = userEvent.setup();
      renderWithProviders(<HomePage />);

      const select = await screen.findByRole("combobox", { name: "Comparar com" });
      await user.selectOptions(select, "semana");
      expect(screen.getByText("Comparar com: semana anterior")).toBeInTheDocument();
    });
  });
});
