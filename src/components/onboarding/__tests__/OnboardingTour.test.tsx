import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OnboardingTour, type TourStep } from "@/components/onboarding/OnboardingTour";
import { expectNoA11yViolations } from "@/test/a11y";

const STEPS: TourStep[] = [
  { title: "Bem-vindo", description: "Um tour rápido pelos módulos principais." },
  { targetSelector: '[data-tour-id="/upload"]', title: "Central de upload", description: "É por aqui que os dados entram." },
  { title: "Pronto!", description: "Você pode rever este tour quando quiser." },
];

// "Passo {n} de {total}" é montado por interpolação JSX — o número e o
// texto ficam em nós de texto IRMÃOS, não um único nó — getByText com
// string exata nunca bate contra isso. Um RegExp casa contra o texto já
// normalizado (espaços colapsados) do elemento inteiro, sem precisar de
// um matcher função sob medida.
function stepCounter(current: number, total: number): RegExp {
  return new RegExp(`Passo\\s+${current}\\s+de\\s+${total}`);
}

function renderTour(onFinish = vi.fn()) {
  const utils = render(
    <div>
      {/* Alvo real do segundo passo — sem isto, useTargetRect não acha
          nada via document.querySelector e o card cai no modo centralizado. */}
      <button data-tour-id="/upload">Central de upload</button>
      <OnboardingTour isOpen steps={STEPS} onFinish={onFinish} />
    </div>
  );
  return { ...utils, onFinish };
}

describe("OnboardingTour", () => {
  it("não renderiza nada quando isOpen é false", () => {
    render(<OnboardingTour isOpen={false} steps={STEPS} onFinish={() => {}} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("mostra o primeiro passo e o contador 'Passo 1 de N'", () => {
    renderTour();
    expect(screen.getByText("Bem-vindo")).toBeInTheDocument();
    expect(screen.getByText(stepCounter(1, 3))).toBeInTheDocument();
    // Primeiro passo não tem "Voltar" (é o início do tour).
    expect(screen.queryByRole("button", { name: "Voltar" })).not.toBeInTheDocument();
  });

  // DECISÃO — findBy*, não getBy*, depois de avançar/voltar passo
  // -------------------------------------------------------------------
  // A troca de passo é animada por AnimatePresence (mode="wait"): o
  // passo antigo só desmonta depois da própria animação de saída
  // terminar, em tempo real (requestAnimationFrame), não sincronamente
  // no mesmo tick do clique. findBy* espera (via polling) até o DOM
  // realmente refletir o novo passo, em vez de checar um instante
  // qualquer no meio da transição.
  it("'Próximo' avança o passo, 'Voltar' retorna", async () => {
    const user = userEvent.setup();
    renderTour();

    await user.click(screen.getByRole("button", { name: "Próximo" }));
    // Busca pelo TÍTULO (heading) do passo, não por texto solto: o teste
    // também renderiza um botão-alvo decoy com o mesmo texto "Central
    // de upload" (ver renderTour) — só o heading é inequívoco.
    expect(await screen.findByRole("heading", { name: "Central de upload" })).toBeInTheDocument();
    expect(await screen.findByText(stepCounter(2, 3))).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Voltar" }));
    expect(await screen.findByRole("heading", { name: "Bem-vindo" })).toBeInTheDocument();
  });

  it("o último passo mostra 'Concluir' em vez de 'Próximo', e chama onFinish", async () => {
    const user = userEvent.setup();
    const { onFinish } = renderTour();

    await user.click(screen.getByRole("button", { name: "Próximo" }));
    await screen.findByRole("heading", { name: "Central de upload" });
    await user.click(screen.getByRole("button", { name: "Próximo" }));

    expect(await screen.findByRole("heading", { name: "Pronto!" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Próximo" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Concluir" }));
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it("'Pular tour' chama onFinish imediatamente, em qualquer passo", async () => {
    const user = userEvent.setup();
    const { onFinish } = renderTour();

    await user.click(screen.getAllByRole("button", { name: "Pular tour" })[0]!);
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it("Escape chama onFinish", async () => {
    const user = userEvent.setup();
    const { onFinish } = renderTour();

    await user.keyboard("{Escape}");
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  // Achado do Laudo de Vistoria Técnica (parecer UX/acessibilidade): sem
  // isto, um usuário de teclado/leitor de tela nunca tinha o foco movido
  // para o card do tour ao abrir — corrigido movendo o foco pro card
  // (tabIndex={-1} + .focus()) a cada passo.
  it("move o foco para o card do tour ao abrir", () => {
    renderTour();
    expect(screen.getByRole("dialog")).toHaveFocus();
  });

  it("o card é um dialog NÃO-modal (rótulo por aria-labelledby, sem aria-modal)", () => {
    renderTour();
    const dialog = screen.getByRole("dialog");
    expect(dialog).not.toHaveAttribute("aria-modal");
    expect(dialog).toHaveAccessibleName("Bem-vindo");
    expect(dialog).toHaveAccessibleDescription("Um tour rápido pelos módulos principais.");
  });

  it("não tem violações de acessibilidade", async () => {
    const { container } = renderTour();
    await expectNoA11yViolations(container);
  });
});
