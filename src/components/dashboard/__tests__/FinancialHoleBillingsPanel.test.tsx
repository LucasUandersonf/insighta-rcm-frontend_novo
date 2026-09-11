import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FinancialHoleBillingsPanel } from "@/components/dashboard/FinancialHoleBillingsPanel";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import type { FinancialHoleBillings } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

const navigateMock = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigateMock };
});

describe("FinancialHoleBillingsPanel", () => {
  it("lista as contas com paciente, procedimento, convênio, valor cobrado e valor contratado", async () => {
    const data: FinancialHoleBillings = {
      period_start: "2026-01-01",
      period_end: "2026-01-07",
      total_count: 1,
      total_hole_value: 50,
      limit: 15,
      offset: 0,
      items: [
        {
          billing_id: "b1",
          patient_full_name: "Paciente Analytics",
          procedure_label: "Consulta em consultório",
          insurance_plan_name: "Unimed Nacional",
          charged_value: 150,
          agreed_price: 200,
          hole_value: 50,
        },
      ],
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<FinancialHoleBillingsPanel dateFrom="2026-01-01" dateTo="2026-01-07" />);

    await waitFor(() => expect(screen.getByText("Paciente Analytics")).toBeInTheDocument());
    expect(screen.getByText("Consulta em consultório")).toBeInTheDocument();
    expect(screen.getByText("Unimed Nacional")).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*150,00/)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*200,00/)).toBeInTheDocument();
    expect(screen.getByText(/-R\$\s*50,00/)).toBeInTheDocument();
  });

  it("mensagem honesta quando nenhuma conta saiu abaixo do contratado", async () => {
    const data: FinancialHoleBillings = {
      period_start: "2026-01-01",
      period_end: "2026-01-07",
      total_count: 0,
      total_hole_value: 0,
      limit: 15,
      offset: 0,
      items: [],
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<FinancialHoleBillingsPanel dateFrom="2026-01-01" dateTo="2026-01-07" />);

    await waitFor(() => expect(screen.getByText(/Nenhuma conta cobrada abaixo do contratado/)).toBeInTheDocument());
  });

  // Achado do usuário direto na tela: antes desta correção a lista era
  // fixa em 15 linhas com um texto avisando "mostrando as N piores de
  // total" e nenhum jeito de ver o resto. Agora usa o componente real
  // de paginação — os 2 testes abaixo cobrem que ele aparece com os
  // números certos e que clicar em "Próxima" busca a página seguinte.
  it("mostra a paginação com o total real quando há mais contas do que a página atual", async () => {
    const data: FinancialHoleBillings = {
      period_start: "2026-01-01",
      period_end: "2026-01-07",
      total_count: 30,
      total_hole_value: 900,
      limit: 15,
      offset: 0,
      items: [
        {
          billing_id: "b1",
          patient_full_name: "Paciente Analytics",
          procedure_label: "Consulta",
          insurance_plan_name: "Unimed",
          charged_value: 150,
          agreed_price: 200,
          hole_value: 50,
        },
      ],
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<FinancialHoleBillingsPanel dateFrom="2026-01-01" dateTo="2026-01-07" />);

    await waitFor(() => expect(screen.getByText("Paciente Analytics")).toBeInTheDocument());
    // "Mostrando 1–1 de 30" (Pagination.tsx) — total real, não mais um
    // texto fixo dizendo "as 15 piores".
    expect(screen.getByText("30")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Próxima página" })).toBeInTheDocument();
  });

  it("clicar em 'Próxima página' busca com o offset seguinte", async () => {
    const page1: FinancialHoleBillings = {
      period_start: "2026-01-01",
      period_end: "2026-01-07",
      total_count: 30,
      total_hole_value: 900,
      limit: 15,
      offset: 0,
      items: [
        {
          billing_id: "b1",
          patient_full_name: "Paciente Página 1",
          procedure_label: "Consulta",
          insurance_plan_name: "Unimed",
          charged_value: 150,
          agreed_price: 200,
          hole_value: 50,
        },
      ],
    };
    const page2: FinancialHoleBillings = { ...page1, offset: 15, items: [{ ...page1.items[0], billing_id: "b2", patient_full_name: "Paciente Página 2" }] };
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      return Promise.resolve(url.includes("offset=15") ? page2 : page1) as never;
    });
    const user = userEvent.setup();

    renderWithProviders(<FinancialHoleBillingsPanel dateFrom="2026-01-01" dateTo="2026-01-07" />);

    await waitFor(() => expect(screen.getByText("Paciente Página 1")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Próxima página" }));
    await waitFor(() => expect(screen.getByText("Paciente Página 2")).toBeInTheDocument());
  });

  it("botão 'Ir para Contratos' navega pra tela de contratos", async () => {
    const data: FinancialHoleBillings = {
      period_start: "2026-01-01",
      period_end: "2026-01-07",
      total_count: 1,
      total_hole_value: 50,
      limit: 15,
      offset: 0,
      items: [
        {
          billing_id: "b1",
          patient_full_name: "Paciente Analytics",
          procedure_label: "Consulta",
          insurance_plan_name: "Unimed",
          charged_value: 150,
          agreed_price: 200,
          hole_value: 50,
        },
      ],
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);
    const user = userEvent.setup();

    renderWithProviders(<FinancialHoleBillingsPanel dateFrom="2026-01-01" dateTo="2026-01-07" />);

    const button = await screen.findByRole("button", { name: "Ir para Contratos" });
    await user.click(button);
    expect(navigateMock).toHaveBeenCalledWith("/contracts");
  });
});
