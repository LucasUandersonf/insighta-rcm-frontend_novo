import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ActionedBadge } from "../InsightWorkflowActions";

describe("ActionedBadge", () => {
  it("diz com quem está a demanda aberta", () => {
    render(<ActionedBadge actioned="atribuido" who="Carla" />);
    expect(screen.getByText("Com Carla")).toBeInTheDocument();
  });

  it("sem o nome, só 'Atribuído'; resolvido continua igual", () => {
    const { rerender } = render(<ActionedBadge actioned="atribuido" />);
    expect(screen.getByText("Atribuído")).toBeInTheDocument();
    rerender(<ActionedBadge actioned="resolvido" who="Carla" />);
    expect(screen.getByText("Marcado como resolvido")).toBeInTheDocument();
  });
});
