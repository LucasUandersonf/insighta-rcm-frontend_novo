import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "@/components/ui/Button";
import { expectNoA11yViolations } from "@/test/a11y";

describe("Button", () => {
  it("renderiza o texto e dispara onClick ao ser clicado", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Salvar</Button>);

    const button = screen.getByRole("button", { name: "Salvar" });
    await user.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("não dispara onClick quando disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Salvar
      </Button>
    );

    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("aceita variant e size sem quebrar a renderização", () => {
    const { rerender } = render(
      <Button variant="secondary" size="sm">
        Cancelar
      </Button>
    );
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeInTheDocument();

    rerender(
      <Button variant="ghost" size="xs">
        Voltar
      </Button>
    );
    expect(screen.getByRole("button", { name: "Voltar" })).toBeInTheDocument();
  });

  it("não tem violações de acessibilidade", async () => {
    const { container } = render(<Button>Salvar</Button>);
    await expectNoA11yViolations(container);
  });
});
