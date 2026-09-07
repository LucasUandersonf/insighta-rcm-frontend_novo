import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider, useToast } from "@/context/ToastContext";
import { expectNoA11yViolations } from "@/test/a11y";

function TriggerButtons() {
  const { showSuccess, showError } = useToast();
  return (
    <>
      <button type="button" onClick={() => showSuccess("Salvo com sucesso")}>
        Disparar sucesso
      </button>
      <button type="button" onClick={() => showError("Algo deu errado")}>
        Disparar erro
      </button>
    </>
  );
}

// DECISÃO — sem fake timers aqui de propósito
// -------------------------------------------------------------------
// O auto-dismiss do toast (setTimeout) compete com a animação de saída
// do Framer Motion (AnimatePresence), que tem seu próprio agendamento
// interno — sob fake timers os dois entram em conflito de forma
// instável. O comportamento de "some sozinho depois de alguns segundos"
// é melhor coberto manualmente (ver Estados.dc.html) do que forçado
// aqui; os testes abaixo cobrem o que é determinístico: papel ARIA
// correto por tom, e dispensa manual via botão de fechar.
describe("ToastContext", () => {
  it("showSuccess renderiza um toast com role=status", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TriggerButtons />
      </ToastProvider>
    );

    await user.click(screen.getByRole("button", { name: "Disparar sucesso" }));
    expect(screen.getByRole("status")).toHaveTextContent("Salvo com sucesso");
  });

  it("showError renderiza um toast com role=alert (anúncio assertivo)", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TriggerButtons />
      </ToastProvider>
    );

    await user.click(screen.getByRole("button", { name: "Disparar erro" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Algo deu errado");
  });

  it("o botão de fechar dispensa o toast", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TriggerButtons />
      </ToastProvider>
    );

    await user.click(screen.getByRole("button", { name: "Disparar sucesso" }));
    await user.click(screen.getByRole("button", { name: "Fechar notificação" }));
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
  });

  it("não tem violações de acessibilidade com um toast visível", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ToastProvider>
        <TriggerButtons />
      </ToastProvider>
    );
    await user.click(screen.getByRole("button", { name: "Disparar sucesso" }));
    await expectNoA11yViolations(container);
  });
});
