import { afterEach, describe, expect, it, vi } from "vitest";
import { addDaysIso, clinicIsoDate } from "@/lib/dates";
import { valuesRead } from "@/lib/rejectedRows";
import { askExample } from "@/lib/useAskInsighta";
import { roundMoneyInText } from "@/components/dashboard/SmartInsightsFeed";
import { clearAllUnsaved, setUnsaved, useUnsavedLabels } from "@/lib/unsavedChanges";
import { renderHook, act } from "@testing-library/react";

describe("UX3-09: datas no dia de Brasília", () => {
  afterEach(() => vi.useRealTimers());

  it("às 23h10 de Brasília ainda é o mesmo dia (antes virava amanhã em UTC)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-12T02:10:00Z")); // 11/10 23h10 em Brasília
    expect(clinicIsoDate()).toBe("2026-10-11");
  });

  it("soma e subtrai dias de uma data AAAA-MM-DD", () => {
    expect(addDaysIso("2026-10-01", -29)).toBe("2026-09-02");
    expect(addDaysIso("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("UX3-10: valor lido", () => {
  it("coluna em branco que causou o erro aparece como (vazio)", () => {
    const text = valuesRead({ payload: { "ID Transação": "T9", Convênio: "", Valor: "120,00" }, raw_value: "Convênio em branco" });
    expect(text).toContain("ID Transação: T9");
    expect(text).toContain("Convênio: (vazio)");
  });
});

describe("UX3-05: exemplo do Pergunte", () => {
  it("sem IA, o exemplo é uma pergunta respondida na hora", () => {
    expect(askExample(false)).toBe("qual convênio mais glosa?");
    expect(askExample(undefined)).toBe("qual convênio mais glosa?");
    expect(askExample(true)).toBe("por que a glosa subiu este mês?");
  });
});

describe("UX3-19: mesmo arredondamento no card", () => {
  it("valores com centavos no texto seguem o destaque sem centavos", () => {
    expect(roundMoneyInText("O caso de maior receita é R$ 96.419,70 no total.")).toMatch(/R\$\s96\.420 no total/);
    expect(roundMoneyInText("Sem valores aqui.")).toBe("Sem valores aqui.");
  });
});

describe("UX3-17: alterações não salvas", () => {
  it("registra e limpa o que está pendente", () => {
    const { result } = renderHook(() => useUnsavedLabels());
    act(() => setUnsaved("a", "a meta de faturamento"));
    expect(result.current).toEqual(["a meta de faturamento"]);
    act(() => setUnsaved("a", null));
    expect(result.current).toEqual([]);
    act(() => setUnsaved("b", "os dados da clínica"));
    act(() => clearAllUnsaved());
    expect(result.current).toEqual([]);
  });
});
