import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { GuardianAlertPage } from "@/pages/GuardianAlertPage";
import { ApiError, actOnGuardianAlert, getGuardianAlert, type GuardianAlertView } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import { expectNoA11yViolations } from "@/test/a11y";

// Mesmo motivo do SatisfactionRatingPage.test: mocka as funções exportadas.
vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, getGuardianAlert: vi.fn(), actOnGuardianAlert: vi.fn() };
});

const ALERT: GuardianAlertView = {
  title: "Prazo de recurso vence em 3 dias",
  message: "4 glosas da Unimed ainda sem recurso.",
  financial_impact: 12500,
  action_url: "https://app.insighta.com.br/glosas",
  sent_at: "2026-10-18T12:00:00Z",
  action: null,
  action_label: null,
  acted_at: null,
  acted_by: null,
  team: [{ id: "u-2", name: "Ana Souza", role: "financeiro" }],
};

function renderAt(path: string) {
  return renderWithProviders(<Routes>{<Route path="/alerta/:token" element={<GuardianAlertPage />} />}</Routes>, {
    route: path,
  });
}

describe("GuardianAlertPage", () => {
  it("mostra o valor em jogo e registra a decisão de resolver", async () => {
    vi.mocked(getGuardianAlert).mockResolvedValue(ALERT);
    vi.mocked(actOnGuardianAlert).mockResolvedValue({ action: "resolver", action_label: "Resolver", outcome_id: "o-1" });
    const user = userEvent.setup();

    renderAt("/alerta/tok123");

    expect(await screen.findByText(ALERT.title)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s?12\.500 em jogo/)).toBeInTheDocument();
    const submit = screen.getByRole("button", { name: "Registrar decisão" });
    expect(submit).toBeDisabled();

    await user.click(screen.getByRole("radio", { name: /Já resolvi/ }));
    await user.click(submit);

    await waitFor(() =>
      expect(actOnGuardianAlert).toHaveBeenCalledWith("tok123", { action: "resolver", assigned_to: null, note: null }),
    );
    expect(await screen.findByText("Decisão registrada: resolver")).toBeInTheDocument();
  });

  it("pré-seleciona a ação do link e exige a pessoa ao delegar", async () => {
    vi.mocked(getGuardianAlert).mockResolvedValue(ALERT);
    vi.mocked(actOnGuardianAlert).mockResolvedValue({ action: "delegar", action_label: "Delegar", outcome_id: "o-1" });
    const user = userEvent.setup();

    renderAt("/alerta/tok123?acao=delegar");

    const submit = await screen.findByRole("button", { name: "Registrar decisão" });
    expect(submit).toBeDisabled();
    await user.selectOptions(screen.getByRole("combobox", { name: "Para quem?" }), "u-2");
    await user.type(screen.getByRole("textbox", { name: /Observação/ }), "Ver hoje");
    await user.click(submit);

    await waitFor(() =>
      expect(actOnGuardianAlert).toHaveBeenCalledWith("tok123", { action: "delegar", assigned_to: "u-2", note: "Ver hoje" }),
    );
  });

  it("mostra quem já decidiu quando o alerta já tem decisão", async () => {
    vi.mocked(getGuardianAlert).mockResolvedValue({ ...ALERT, action: "ignorar", action_label: "Ignorar", acted_by: "Carlos" });

    renderAt("/alerta/tok123");

    expect(await screen.findByText("Decisão registrada: ignorar")).toBeInTheDocument();
    expect(screen.getByText("Este alerta já foi decidido por Carlos.")).toBeInTheDocument();
  });

  it("mostra link inválido quando o token não existe", async () => {
    vi.mocked(getGuardianAlert).mockRejectedValue(new ApiError(404, { error_code: "not_found", message: "Link inválido ou expirado.", request_id: "r1" }));

    renderAt("/alerta/expirado");

    expect(await screen.findByText("Link inválido ou expirado")).toBeInTheDocument();
  });

  it("não tem violações de acessibilidade", async () => {
    vi.mocked(getGuardianAlert).mockResolvedValue(ALERT);

    const { container } = renderAt("/alerta/tok123");

    expect(await screen.findByText(ALERT.title)).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });
});
