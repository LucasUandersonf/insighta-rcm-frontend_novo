import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ManualContractModal } from "@/components/contracts/ContractModals";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import type { InsurancePlan } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn(), post: vi.fn(), upload: vi.fn() } };
});

const PLAN = { id: "plan-1", display_name: "Unimed Nacional" } as InsurancePlan;

describe("ManualContractModal — homologação fácil", () => {
  it("sugere a tabela pelo que o convênio pagou e preenche os itens", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      items: [
        { tuss_code: "10101012", procedure_name: "Consulta", agreed_price: 110, warning: null, source: "pago", count: 3 },
        { tuss_code: "40301630", procedure_name: "Hemograma", agreed_price: 80, warning: "Confira com o contrato.", source: "cobrado", count: 2 },
      ],
      billed_codes: 2,
      without_price: 0,
    } as never);
    renderWithProviders(<ManualContractModal isOpen onClose={() => {}} plans={[PLAN]} />);

    await userEvent.click(screen.getByRole("button", { name: "Sugerir pelo que o convênio pagou" }));
    expect(await screen.findByText(/Escolha o convênio/)).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText(/Convênio/), "plan-1");
    await userEvent.click(screen.getByRole("button", { name: "Sugerir pelo que o convênio pagou" }));
    await waitFor(() => expect(screen.getByDisplayValue("40301630")).toBeInTheDocument());
    expect(vi.mocked(apiClient.get)).toHaveBeenCalledWith("/api/v1/contracts/suggest-items?insurance_plan_id=plan-1");
    expect(screen.getByDisplayValue("10101012")).toBeInTheDocument();
    expect(screen.getByText(/1 pelo que o convênio pagou, 1 pelo valor mais cobrado/)).toBeInTheDocument();
    expect(screen.getByText("40301630: Confira com o contrato.")).toBeInTheDocument();
  });

  it("importa a planilha da tabela de preços", async () => {
    vi.mocked(apiClient.upload).mockResolvedValue({
      items: [{ tuss_code: "10101012", procedure_name: "Consulta", agreed_price: 150, warning: null, source: null, count: null }],
      warnings: ["Linha 3 (X1): valor zerado ou negativo."],
      rejected: 1,
    } as never);
    renderWithProviders(<ManualContractModal isOpen onClose={() => {}} plans={[PLAN]} />);
    const file = new File(["codigo;valor\n10101012;150,00\n"], "tabela.csv", { type: "text/csv" });
    fireEvent.change(screen.getByLabelText("Planilha da tabela de preços"), { target: { files: [file] } });

    await waitFor(() => expect(screen.getByDisplayValue("10101012")).toBeInTheDocument());
    expect(vi.mocked(apiClient.upload).mock.calls[0][0]).toBe("/api/v1/contracts/price-table/parse");
    expect(screen.getByText(/1 itens lidos da planilha, 1 linha\(s\) ignorada\(s\)/)).toBeInTheDocument();
    expect(screen.getByText("Linha 3 (X1): valor zerado ou negativo.")).toBeInTheDocument();
  });
});
