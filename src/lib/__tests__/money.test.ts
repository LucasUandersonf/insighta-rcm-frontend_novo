import { describe, expect, it } from "vitest";
import { formatMoneyInput, parseMoneyBR } from "@/lib/money";

// Mesmas regras de app/core/money.py (backend). O caso que motivou o
// módulo: "2.400.000,00" na meta anual gravava R$ 2,40.
describe("parseMoneyBR", () => {
  it.each([
    ["2.400.000,00", 2400000, "2400000.00"],
    ["2.400.000", 2400000, "2400000.00"],
    ["10.005", 10005, "10005.00"],
    ["1.250,5", 1250.5, "1250.50"],
    ["R$ 1.250,50", 1250.5, "1250.50"],
    ["1250.50", 1250.5, "1250.50"],
    ["0,01", 0.01, "0.01"],
    ["  300  ", 300, "300.00"],
  ])("aceita %s", (input, value, normalized) => {
    expect(parseMoneyBR(input)).toEqual({ ok: true, value, normalized });
  });

  it.each(["2.40000000", "2.40.000", "1,2,3", "12,345", "1.2345", "abc", "", "R$", "-5", "99.999.999.999,00"])(
    "recusa %s",
    (input) => {
      const result = parseMoneyBR(input);
      expect(result.ok).toBe(false);
    }
  );

  it("explica o formato esperado", () => {
    const result = parseMoneyBR("2.40000000");
    expect(result.ok === false && result.error).toContain("2.400.000,00");
  });
});

describe("formatMoneyInput", () => {
  it("formata no padrão brasileiro e deixa vazio o que não é número", () => {
    expect(formatMoneyInput(2400000)).toBe("2.400.000,00");
    expect(formatMoneyInput(0.5)).toBe("0,50");
    expect(formatMoneyInput(null)).toBe("");
    expect(formatMoneyInput(Number.NaN)).toBe("");
  });
});
