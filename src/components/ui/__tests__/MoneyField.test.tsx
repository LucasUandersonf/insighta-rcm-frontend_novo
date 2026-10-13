import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MoneyField, MoneyInput } from "@/components/ui/MoneyField";

function ControlledField() {
  const [value, setValue] = useState("");
  return <MoneyField label="Valor" value={value} onValueChange={setValue} />;
}

describe("MoneyField", () => {
  it("mostra o valor que vai ser salvo e reescreve no padrão brasileiro ao sair", async () => {
    const user = userEvent.setup();
    render(<ControlledField />);
    const field = screen.getByLabelText("Valor");
    await user.type(field, "2400000");
    expect(screen.getByText("R$ 2.400.000,00")).toBeInTheDocument();
    await user.tab();
    expect(field).toHaveValue("2.400.000,00");
  });

  it("aponta o valor malformado ao sair do campo", async () => {
    const user = userEvent.setup();
    render(<ControlledField />);
    await user.type(screen.getByLabelText("Valor"), "2.40000000");
    await user.tab();
    expect(screen.getByRole("alert")).toHaveTextContent("Use o formato 2.400.000,00");
    expect(screen.getByLabelText("Valor")).toHaveAttribute("aria-invalid", "true");
  });

  it("usa teclado numérico no celular", () => {
    render(<ControlledField />);
    expect(screen.getByLabelText("Valor")).toHaveAttribute("inputmode", "decimal");
  });
});

describe("MoneyInput", () => {
  it("entrega o número quando válido e 0 quando inválido", async () => {
    const onValueChange = vi.fn();
    const user = userEvent.setup();
    render(<MoneyInput aria-label="Preço" value={0} onValueChange={onValueChange} />);
    await user.type(screen.getByLabelText("Preço"), "1.250,5");
    expect(onValueChange).toHaveBeenLastCalledWith(1250.5);
    await user.type(screen.getByLabelText("Preço"), "55"); // "1.250,555": 3 casas decimais
    expect(onValueChange).toHaveBeenLastCalledWith(0);
    expect(screen.getByLabelText("Preço")).toHaveAttribute("aria-invalid", "true");
  });

  it("acompanha quando o formulário limpa o valor por fora", () => {
    const { rerender } = render(<MoneyInput aria-label="Preço" value={300} onValueChange={() => {}} />);
    expect(screen.getByLabelText("Preço")).toHaveValue("300,00");
    rerender(<MoneyInput aria-label="Preço" value={0} onValueChange={() => {}} />);
    expect(screen.getByLabelText("Preço")).toHaveValue("");
  });
});
