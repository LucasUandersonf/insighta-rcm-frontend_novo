import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BillingSearchPicker } from "@/components/billing/BillingSearchPicker";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import type { BillingSearchItem } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

const RESULT: BillingSearchItem = {
  id: "b1",
  patient_name: "Maria da Silva Santos",
  procedure_code: "10101012",
  insurance_plan_name: "Unimed Nacional",
  charged_value: 500,
  status: "pending",
  denial_risk_level: "high",
  created_at: "2026-08-20T00:00:00Z",
};

function Wrapper() {
  const [selected, setSelected] = useState<BillingSearchItem | null>(null);
  return <BillingSearchPicker selected={selected} onSelect={setSelected} />;
}

describe("BillingSearchPicker", () => {
  it("busca por nome, lista resultados e permite selecionar um faturamento", async () => {
    vi.mocked(apiClient.get).mockResolvedValue([RESULT]);
    const user = userEvent.setup();

    renderWithProviders(<Wrapper />);

    const input = screen.getByLabelText(/Buscar faturamento/);
    await user.type(input, "Maria da Silva");

    await waitFor(() => expect(screen.getByText("Maria da Silva Santos")).toBeInTheDocument(), { timeout: 2000 });
    expect(apiClient.get).toHaveBeenCalledWith(expect.stringContaining("/api/v1/billing/search?q="));

    await user.click(screen.getByText("Maria da Silva Santos"));

    // Depois de selecionado, o campo de busca some e o resumo do
    // faturamento escolhido aparece no lugar dele.
    expect(screen.queryByLabelText(/Buscar faturamento/)).not.toBeInTheDocument();
    expect(screen.getByText("Maria da Silva Santos")).toBeInTheDocument();
    expect(screen.getByText(/Unimed Nacional/)).toBeInTheDocument();
  });

  it("botão de trocar volta para o campo de busca", async () => {
    vi.mocked(apiClient.get).mockResolvedValue([RESULT]);
    const user = userEvent.setup();

    renderWithProviders(<Wrapper />);
    await user.type(screen.getByLabelText(/Buscar faturamento/), "Maria");
    await waitFor(() => expect(screen.getByText("Maria da Silva Santos")).toBeInTheDocument(), { timeout: 2000 });
    await user.click(screen.getByText("Maria da Silva Santos"));

    await user.click(screen.getByRole("button", { name: "Trocar faturamento selecionado" }));
    expect(screen.getByLabelText(/Buscar faturamento/)).toBeInTheDocument();
  });

  it("não busca com menos de 2 caracteres", async () => {
    vi.mocked(apiClient.get).mockClear();
    vi.mocked(apiClient.get).mockResolvedValue([]);
    const user = userEvent.setup();

    renderWithProviders(<Wrapper />);
    await user.type(screen.getByLabelText(/Buscar faturamento/), "M");

    await new Promise((r) => setTimeout(r, 400));
    expect(apiClient.get).not.toHaveBeenCalled();
  });
});
