import { describe, expect, it } from "vitest";
import { valuesRead } from "@/lib/rejectedRows";

// UX2-15: a linha inválida mostra o valor lido, não só o motivo.
describe("valuesRead", () => {
  it("mostra o ID e a coluna de data quando o motivo é de data", () => {
    const text = valuesRead({
      raw_value: "Data inexistente no calendário (confira dia e mês).",
      payload: { id_transacao: "T-292", paciente: "Ana", data_atendimento: "31/02/2026", valor_cobrado: "120,00" },
    });
    expect(text).toBe("id_transacao: T-292 · data_atendimento: 31/02/2026");
  });

  it("mostra a coluna de valor quando o motivo é de valor", () => {
    expect(valuesRead({ raw_value: "Valor sem nenhum dígito.", payload: { id: "9", valor_cobrado: "abc" } })).toBe(
      "id: 9 · valor_cobrado: abc"
    );
  });

  it("sem coluna que combine, mostra as primeiras colunas preenchidas", () => {
    expect(valuesRead({ raw_value: "Campo obrigatório ausente.", payload: { a: "1", b: "", c: "3" } })).toBe("a: 1 · c: 3");
  });
});
