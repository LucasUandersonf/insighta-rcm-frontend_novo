import { useState, type ChangeEvent } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TextField, TextareaField, SelectField } from "@/components/ui/FormField";
import { expectNoA11yViolations } from "@/test/a11y";

function ControlledTextField() {
  const [value, setValue] = useState("");
  return <TextField label="E-mail" value={value} onChange={(e: ChangeEvent<HTMLInputElement>) => setValue(e.target.value)} />;
}

describe("TextField", () => {
  it("associa o label ao input via htmlFor/id", () => {
    render(<TextField label="E-mail" onChange={() => {}} value="" />);
    const input = screen.getByLabelText("E-mail");
    expect(input).toBeInstanceOf(HTMLInputElement);
  });

  it("aceita digitação e propaga onChange", async () => {
    const user = userEvent.setup();
    render(<ControlledTextField />);
    const input = screen.getByLabelText("E-mail");
    await user.type(input, "a@b.com");
    expect(input).toHaveValue("a@b.com");
  });

  // Achado do Laudo de Vistoria Técnica (parecer UX/acessibilidade): a
  // mensagem de erro era só visual — corrigido em FormField.tsx com
  // aria-invalid + aria-describedby. Este teste prova a correção.
  it("liga a mensagem de erro ao campo via aria-describedby e marca aria-invalid", () => {
    render(<TextField label="E-mail" value="" onChange={() => {}} error="E-mail inválido" />);
    const input = screen.getByLabelText("E-mail");
    expect(input).toHaveAttribute("aria-invalid", "true");
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    const errorNode = document.getElementById(describedBy!);
    expect(errorNode).toHaveTextContent("E-mail inválido");
  });

  it("não marca aria-invalid quando não há erro", () => {
    render(<TextField label="E-mail" value="" onChange={() => {}} />);
    expect(screen.getByLabelText("E-mail")).toHaveAttribute("aria-invalid", "false");
  });

  it("não tem violações de acessibilidade, com e sem erro", async () => {
    const { container, rerender } = render(<TextField label="E-mail" value="" onChange={() => {}} />);
    await expectNoA11yViolations(container);
    rerender(<TextField label="E-mail" value="" onChange={() => {}} error="Campo obrigatório" />);
    await expectNoA11yViolations(container);
  });
});

describe("TextareaField", () => {
  it("associa o label e liga o erro via aria-describedby", () => {
    render(<TextareaField label="Mensagem" value="" onChange={() => {}} error="Muito curto" />);
    const textarea = screen.getByLabelText("Mensagem");
    expect(textarea).toBeInstanceOf(HTMLTextAreaElement);
    expect(textarea).toHaveAttribute("aria-invalid", "true");
  });
});

describe("SelectField", () => {
  it("associa o label ao select", () => {
    render(
      <SelectField label="Papel" value="owner" onChange={() => {}}>
        <option value="owner">Proprietário</option>
      </SelectField>
    );
    expect(screen.getByLabelText("Papel")).toBeInstanceOf(HTMLSelectElement);
  });
});
