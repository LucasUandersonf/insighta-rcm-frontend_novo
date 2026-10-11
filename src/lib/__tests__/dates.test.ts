import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { formatDateBR, parseApiDate } from "@/lib/dates";

// UX2-11: "2026-01-01" aparecia como 31/12/2025 no Brasil. O teste roda no
// fuso de São Paulo (o CI roda em UTC, onde o erro não aparecia).
const originalTz = process.env.TZ;
beforeAll(() => {
  process.env.TZ = "America/Sao_Paulo";
});
afterAll(() => {
  process.env.TZ = originalTz;
});

describe("formatDateBR", () => {
  it("data sem hora é o dia local, não meia-noite UTC", () => {
    // Prova de que o fuso está valendo: o jeito antigo erra o dia aqui.
    expect(new Date("2026-01-01").getDate()).toBe(31);
    expect(formatDateBR("2026-01-01")).toBe("01/01/2026");
    expect(parseApiDate("2026-01-01").getDate()).toBe(1);
  });

  it("aceita outro formato e devolve o texto padrão para vazio ou inválido", () => {
    expect(formatDateBR("2026-03-09", { day: "2-digit", month: "2-digit" })).toBe("09/03");
    expect(formatDateBR(null)).toBe("—");
    expect(formatDateBR("lixo", undefined, "nunca")).toBe("nunca");
  });

  it("data com hora continua sendo um instante", () => {
    expect(parseApiDate("2026-01-01T12:00:00Z").toISOString()).toBe("2026-01-01T12:00:00.000Z");
  });
});
