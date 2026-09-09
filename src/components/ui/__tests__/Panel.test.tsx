import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Panel } from "@/components/ui/Panel";

describe("Panel", () => {
  it("sem `glow`, não aplica nenhuma classe de hover tingida (comportamento padrão preservado)", () => {
    render(<Panel title="Sem atenção">conteúdo</Panel>);
    const card = screen.getByText("Sem atenção").closest("div.group");
    expect(card?.className).not.toMatch(/hover:border-(denied|pending|revenue|accent|tier1)\//);
  });

  it("repassa `glow` para o BentoCard por baixo — mesmo mecanismo de atenção da Sala de Comando", () => {
    render(
      <Panel title="Fila de correção" glow="pending">
        conteúdo
      </Panel>
    );
    const card = screen.getByText("Fila de correção").closest("div.group");
    expect(card?.className).toMatch(/hover:border-pending\/40/);
  });
});
