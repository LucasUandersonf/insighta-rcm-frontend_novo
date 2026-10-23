import { describe, expect, it } from "vitest";
import { insightItemKey } from "@/components/dashboard/InsightWorkflowActions";

// Mesma chave que o backend grava (app/core/text_utils.slugify): é por ela
// que a Sala sabe que um insight já tem demanda aberta e não oferece
// "Atribuir" de novo (homologação v1.0.0).
describe("insightItemKey", () => {
  it("usa o fact_key quando existe", () => {
    expect(insightItemKey({ category: "faturamento", title: "X", fact_key: "pago_menos_sem_recurso" })).toBe("pago_menos_sem_recurso");
  });
  it("sem fact_key, slug de categoria:título sem acento", () => {
    expect(insightItemKey({ category: "agenda", title: "Horários vazios valem R$ 184 mil" })).toBe(
      "agenda_horarios_vazios_valem_r_184_mil"
    );
  });
});
