import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PreSubmissionCheckPage } from "@/pages/PreSubmissionCheckPage";
import { CashForecastPage } from "@/pages/CashForecastPage";
import { RecoveryCenterPage } from "@/pages/RecoveryCenterPage";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import { expectNoA11yViolations } from "@/test/a11y";
import type { CashForecast, PreSubmissionGroup, PreSubmissionOverview, RecoveryCenter } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn(), post: vi.fn() } };
});

let mockRole = "financeiro";
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { sub: "u1", tenant_id: "t1", role: mockRole } }),
}));

const GROUP: PreSubmissionGroup = {
  key: "p1|sem|",
  plan_id: "p1",
  plan_name: "Unimed",
  lote_label: "Sem lote",
  lote_kind: "sem",
  verdict: "revisar",
  items: 5,
  total_value: 900,
  blocking_items: 2,
  blocking_value: 500,
  gain_value: 50,
  expected_denial: 180,
  denial_rate: 0.2,
  oldest_service_date: "2026-10-10",
  issues: [
    {
      code: "duplicada",
      label: "Cobrança em duplicidade",
      what_to_do: "Remova a cobrança repetida antes de enviar.",
      blocking: true,
      kind: "perda",
      count: 1,
      value: 300,
      items: [{ billing_id: "b1", service_date: "2026-10-15", patient: "Ana Lima", procedure: "Consulta", value: 300 }],
    },
    {
      code: "abaixo_contrato",
      label: "Cobrando menos que o contrato",
      what_to_do: "Corrija o valor.",
      blocking: false,
      kind: "ganho",
      count: 1,
      value: 50,
      items: [],
    },
  ],
};

const OVERVIEW: PreSubmissionOverview = {
  groups: [
    { ...GROUP, issues: GROUP.issues.map((i) => ({ ...i, items: [] })) },
    { ...GROUP, key: "p1|erp|L-7", lote_label: "Lote do ERP L-7", lote_kind: "erp", verdict: "pronto", blocking_items: 0, blocking_value: 0, issues: [] },
  ],
  total_items: 7,
  total_value: 1100,
  blocking_value: 500,
  gain_value: 50,
  ready_groups: 1,
  review_groups: 1,
  truncated: false,
};

describe("PreSubmissionCheckPage", () => {
  it("lista convênio e lote com veredito e abre as checagens com as contas", async () => {
    vi.mocked(apiClient.get).mockImplementation(((path: string) =>
      Promise.resolve(path.includes("detalhe") ? GROUP : OVERVIEW)) as never);
    const { container } = renderWithProviders(<PreSubmissionCheckPage />);

    expect(await screen.findByText("Unimed · Sem lote")).toBeInTheDocument();
    expect(screen.getByText("Unimed · Lote do ERP L-7")).toBeInTheDocument();
    expect(screen.getByText("Revisar antes")).toBeInTheDocument();
    expect(screen.getByText("Pronto para enviar")).toBeInTheDocument();
    await expectNoA11yViolations(container);

    await userEvent.click(screen.getByRole("button", { name: /Unimed · Sem lote/ }));
    expect(await screen.findByText("Cobrança em duplicidade")).toBeInTheDocument();
    expect(screen.getByText("Ana Lima")).toBeInTheDocument();
    expect(screen.getByText(/Bloqueia o envio/)).toBeInTheDocument();
    expect(vi.mocked(apiClient.get)).toHaveBeenLastCalledWith("/api/v1/financeiro/conferencia-envio/detalhe?key=p1%7Csem%7C");
  });

  it("mostra estado vazio sem contas esperando envio", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ ...OVERVIEW, groups: [] } as never);
    renderWithProviders(<PreSubmissionCheckPage />);
    expect(await screen.findByText(/Nenhuma conta esperando envio/)).toBeInTheDocument();
  });
});

const CASH: CashForecast = {
  today: "2026-10-21",
  week_start: "2026-10-19",
  weeks: Array.from({ length: 13 }, (_, i) => ({
    start: `2026-${i < 2 ? "10" : "11"}-${String(10 + i).padStart(2, "0")}`,
    end: `2026-${i < 2 ? "10" : "11"}-${String(16 + (i % 10)).padStart(2, "0")}`,
    gross: i === 2 ? 1000 : 0,
    net: i === 2 ? 800 : 0,
    count: i === 2 ? 3 : 0,
    top_plans: i === 2 ? ([["Unimed", 800]] as [string, number][]) : [],
  })),
  expected_net: 800,
  expected_denial: 200,
  overdue_submitted: 500,
  overdue_unsent: 300,
  later: 0,
  open_gross: 1800,
  history: [{ start: "2026-09-21", received: 400 }],
  plans: [{ plan_name: "Unimed", lag_days: 20, lag_source: "historico", denial_rate: 0.2, open_gross: 1800, overdue: 800 }],
};

describe("CashForecastPage", () => {
  it("mostra o que deve entrar, os atrasos e o prazo de cada convênio", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(CASH as never);
    const { container } = renderWithProviders(<CashForecastPage />);
    expect(await screen.findByText("Deve entrar em 13 semanas")).toBeInTheDocument();
    expect(screen.getAllByText(/R\$\s?800,00/).length).toBeGreaterThan(0);
    expect(screen.getByText("Atrasado no convênio")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cobrar na Central de Recuperação" })).toHaveAttribute("href", "/recuperacao");
    expect(screen.getByText("20 dias")).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });
});

const RECOVERY: RecoveryCenter = {
  recoverable: 910,
  in_appeal: 400,
  due_7_days: 400,
  fronts: [
    {
      code: "glosa_sem_recurso",
      label: "Glosa sem recurso",
      what_to_do: "Abra o recurso antes do prazo acabar.",
      action: "abrir_recurso",
      count: 1,
      value: 120,
      items: [
        {
          billing_id: "b9",
          plan_name: "Unimed",
          patient: "Ana Lima",
          service_date: "2026-10-01",
          value: 120,
          reason: "Falta de autorização",
          deadline: "2026-10-23",
          days_left: 2,
          appeal_id: null,
          status: null,
          denied_at: "2026-10-13",
        },
      ],
    },
    { code: "em_recurso", label: "Em recurso", what_to_do: "Acompanhe.", action: "ver_recurso", count: 0, value: 400, items: [] },
  ],
  results: {
    days: 90,
    recovered: 250,
    recovered_count: 1,
    denied: 0,
    denied_count: 0,
    lost_deadline: 90,
    lost_deadline_count: 1,
    success_rate: 1,
  },
};

describe("RecoveryCenterPage", () => {
  it("mostra as frentes, o resultado e abre o recurso com um clique", async () => {
    mockRole = "financeiro";
    vi.mocked(apiClient.get).mockResolvedValue(RECOVERY as never);
    vi.mocked(apiClient.post).mockResolvedValue({} as never);
    const { container } = renderWithProviders(<RecoveryCenterPage />);

    expect(await screen.findByText("Falta de autorização")).toBeInTheDocument();
    expect(screen.getByText(/perderam o\s+prazo de recurso/)).toBeInTheDocument();
    expect(screen.getByText(/2 dias/)).toBeInTheDocument();
    await expectNoA11yViolations(container);

    await userEvent.click(screen.getByRole("button", { name: "Abrir recurso" }));
    await waitFor(() =>
      expect(vi.mocked(apiClient.post)).toHaveBeenCalledWith("/api/v1/denial-appeals", {
        billing_id: "b9",
        appeal_type: "administrativa",
        denied_at: "2026-10-13",
        operator_denial_reason: "Falta de autorização",
      }),
    );
  });

  it("marca como cobrado nas frentes de cobrança e mostra a data depois", async () => {
    mockRole = "financeiro";
    const center: RecoveryCenter = {
      ...RECOVERY,
      fronts: [
        {
          code: "sem_retorno",
          label: "Sem retorno do convênio",
          what_to_do: "Cobre o convênio.",
          action: "cobrar_convenio",
          count: 2,
          value: 790,
          items: [
            { ...RECOVERY.fronts[0].items[0], billing_id: "b1", reason: "Enviada em 01/07/2026", charged_at: null },
            { ...RECOVERY.fronts[0].items[0], billing_id: "b2", reason: "Enviada em 02/07/2026", charged_at: "2026-10-10T12:00:00Z" },
          ],
        },
      ],
    };
    vi.mocked(apiClient.get).mockResolvedValue(center as never);
    vi.mocked(apiClient.post).mockResolvedValue({} as never);
    renderWithProviders(<RecoveryCenterPage />);

    expect(await screen.findByText(/Cobrado em 10\/10/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Marcar como cobrado" }));
    await waitFor(() =>
      expect(vi.mocked(apiClient.post)).toHaveBeenCalledWith("/api/v1/financeiro/recuperacao/cobrado", {
        billing_id: "b1",
        front: "sem_retorno",
      }),
    );
  });

  it("auditor vê a central mas não abre recurso", async () => {
    mockRole = "auditor";
    vi.mocked(apiClient.get).mockResolvedValue(RECOVERY as never);
    renderWithProviders(<RecoveryCenterPage />);
    expect(await screen.findByText("Falta de autorização")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Abrir recurso" })).not.toBeInTheDocument();
  });
});

describe("RecoveryCenterPage — homologação v1.0.0", () => {
  it("mostra as 10 mais urgentes e o resto atrás de 'Ver todas'", async () => {
    mockRole = "financeiro";
    const base = RECOVERY.fronts[0].items[0];
    const items = Array.from({ length: 12 }, (_, i) => ({ ...base, billing_id: `b${i}`, reason: `Motivo ${i}` }));
    vi.mocked(apiClient.get).mockResolvedValue({
      ...RECOVERY,
      fronts: [{ ...RECOVERY.fronts[0], count: 12, items }, RECOVERY.fronts[1]],
    } as never);
    renderWithProviders(<RecoveryCenterPage />);
    expect(await screen.findByText("Motivo 9")).toBeInTheDocument();
    expect(screen.queryByText("Motivo 10")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Ver todas as 12 contas" }));
    expect(screen.getByText("Motivo 11")).toBeInTheDocument();
  });
});
