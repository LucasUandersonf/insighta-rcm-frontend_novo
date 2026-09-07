import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "@/components/ui/Badge";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { NoShowBadge } from "@/components/ui/NoShowBadge";
import { expectNoA11yViolations } from "@/test/a11y";

describe("Badge", () => {
  it("renderiza o texto passado como children", () => {
    render(<Badge tone="revenue">Ativo</Badge>);
    expect(screen.getByText("Ativo")).toBeInTheDocument();
  });

  it("não tem violações de acessibilidade", async () => {
    const { container } = render(<Badge tone="denied">Glosado</Badge>);
    await expectNoA11yViolations(container);
  });
});

describe("RiskBadge", () => {
  // Vocabulário do motor de glosa (low/medium/high) — ver
  // app/services/denial_risk_engine.py no backend.
  it.each([
    ["low", "Baixo"],
    ["medium", "Médio"],
    ["high", "Alto"],
  ] as const)("nível %s mostra o rótulo em português %s", (level, label) => {
    render(<RiskBadge level={level} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});

describe("NoShowBadge", () => {
  // Vocabulário DIFERENTE do RiskBadge — espelha
  // app/services/no_show_risk_engine.py (indeterminado/baixo/medio/alto).
  it.each([
    ["indeterminado", "Sem histórico"],
    ["baixo", "Baixo"],
    ["medio", "Médio"],
    ["alto", "Alto"],
  ] as const)("nível %s mostra o rótulo %s", (level, label) => {
    render(<NoShowBadge level={level} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("mostra travessão quando o nível é null (sem agendamento suficiente)", () => {
    render(<NoShowBadge level={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
