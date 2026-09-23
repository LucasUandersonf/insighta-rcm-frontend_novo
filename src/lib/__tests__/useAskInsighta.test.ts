import { describe, expect, it } from "vitest";
import { askQuotaNote } from "@/lib/useAskInsighta";
import type { AiUsageSummary } from "@/lib/types";

function summary(used: number, limit: number): AiUsageSummary {
  return {
    month_start: "2026-09-01",
    renews_on: "2026-10-01",
    cost_usd: 0.4,
    items: [{ kind: "ask", label: "Perguntas à IA", used, limit }],
  };
}

describe("askQuotaNote", () => {
  it("mostra quantas perguntas restam e quando acabou", () => {
    expect(askQuotaNote(summary(88, 100))).toBe("Restam 12 de 100 perguntas à IA este mês.");
    expect(askQuotaNote(summary(100, 100))).toBe("A cota de 100 perguntas à IA deste mês acabou.");
  });

  it("sem cota ou sem dado, não mostra nada", () => {
    expect(askQuotaNote(summary(5, 0))).toBeNull();
    expect(askQuotaNote(undefined)).toBeNull();
  });
});
