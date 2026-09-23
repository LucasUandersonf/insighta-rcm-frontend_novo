import { describe, expect, it } from "vitest";
import { deadlineOptions, dueLabel } from "@/lib/team";

describe("team — textos de prazo", () => {
  const tuesday = new Date(2026, 8, 23, 10, 0); // terça, 23/09/2026

  it("dueLabel fala como gente", () => {
    expect(dueLabel("2026-09-23", tuesday)).toBe("Hoje");
    expect(dueLabel("2026-09-24", tuesday)).toBe("Amanhã");
    expect(dueLabel("2026-09-22", tuesday)).toBe("Ontem (22/09)");
    expect(dueLabel("2026-09-26", tuesday)).toBe("Sábado (26/09)");
    expect(dueLabel(null, tuesday)).toBe("Sem prazo");
  });

  it("chips de prazo do canvas: Hoje, Amanhã, próxima sexta, Escolher data", () => {
    expect(deadlineOptions(tuesday).map((o) => o.label)).toEqual(["Hoje", "Amanhã", "Sexta (25/09)", "Escolher data"]);
    const thursday = new Date(2026, 8, 24, 10, 0);
    // Sexta = amanhã -> pula para a sexta seguinte.
    expect(deadlineOptions(thursday)[2]!.label).toBe("Sexta (02/10)");
  });
});
