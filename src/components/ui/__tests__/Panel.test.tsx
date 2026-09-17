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

  // Épico F4.3 do Plano Diretor ("Frescor de dado / SLA de atualização").
  it("sem `updatedAt`, não mostra nenhum selo de frescor", () => {
    render(<Panel title="Sem selo">conteúdo</Panel>);
    expect(screen.queryByText(/atualizado/)).not.toBeInTheDocument();
  });

  it("com `updatedAt` recente, mostra 'atualizado agora'", () => {
    render(
      <Panel title="Com selo" updatedAt={Date.now()}>
        conteúdo
      </Panel>
    );
    expect(screen.getByText("atualizado agora")).toBeInTheDocument();
  });

  it("com `updatedAt` de alguns minutos atrás, mostra a contagem em minutos", () => {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    render(
      <Panel title="Com selo antigo" updatedAt={fiveMinutesAgo}>
        conteúdo
      </Panel>
    );
    expect(screen.getByText("atualizado há 5 min")).toBeInTheDocument();
  });
});
