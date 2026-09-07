import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Modal } from "@/components/ui/Modal";
import { ModalStackProvider } from "@/context/ModalStackContext";
import { expectNoA11yViolations } from "@/test/a11y";

function TestModal({ onClose }: { onClose: () => void }) {
  return (
    <ModalStackProvider>
      <Modal title="Confirmar ação" isOpen onClose={onClose}>
        <button type="button">Primeiro botão</button>
        <button type="button">Segundo botão</button>
      </Modal>
    </ModalStackProvider>
  );
}

describe("Modal", () => {
  it("renderiza o título e o conteúdo quando isOpen", () => {
    render(<TestModal onClose={() => {}} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Confirmar ação")).toBeInTheDocument();
  });

  it("não renderiza nada quando isOpen é false", () => {
    render(
      <ModalStackProvider>
        <Modal title="Confirmar ação" isOpen={false} onClose={() => {}}>
          conteúdo
        </Modal>
      </ModalStackProvider>
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Escape chama onClose", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<TestModal onClose={onClose} />);
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("o botão 'Fechar' chama onClose", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<TestModal onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "Fechar" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("move o foco para dentro do modal ao abrir", () => {
    render(<TestModal onClose={() => {}} />);
    // O primeiro elemento focável dentro do modal é o próprio botão
    // "Fechar" (topo do cabeçalho) — ver Modal.tsx.
    expect(screen.getByRole("button", { name: "Fechar" })).toHaveFocus();
  });

  it("Tab no último elemento focável volta para o primeiro (focus trap)", async () => {
    const user = userEvent.setup();
    render(<TestModal onClose={() => {}} />);

    screen.getByRole("button", { name: "Segundo botão" }).focus();
    await user.keyboard("{Tab}");
    expect(screen.getByRole("button", { name: "Fechar" })).toHaveFocus();
  });

  function Wrapper() {
    const [isOpen, setIsOpen] = useState(false);
    return (
      <ModalStackProvider>
        <button type="button" onClick={() => setIsOpen(true)}>
          Abrir
        </button>
        <Modal title="Confirmar ação" isOpen={isOpen} onClose={() => setIsOpen(false)}>
          <button type="button">Ok</button>
        </Modal>
      </ModalStackProvider>
    );
  }

  it("devolve o foco para quem abriu o modal, depois de fechar", async () => {
    const user = userEvent.setup();
    render(<Wrapper />);

    const openButton = screen.getByRole("button", { name: "Abrir" });
    await user.click(openButton);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(openButton).toHaveFocus();
  });

  it("não tem violações de acessibilidade", async () => {
    const { container } = render(<TestModal onClose={() => {}} />);
    await expectNoA11yViolations(container);
  });
});
