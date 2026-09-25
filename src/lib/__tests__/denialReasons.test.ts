import { describe, expect, it } from "vitest";
import { denialReasonLabel, denialReasonsText } from "@/lib/denialReasons";

describe("motivos do motor de glosa em português", () => {
  it("traduz os códigos conhecidos e junta vários motivos", () => {
    expect(denialReasonsText(["missing_cid", "no_contract_reference"])).toBe("Falta o CID · Sem tabela de preço");
  });

  it("código novo do backend aparece como veio, sem quebrar a tela", () => {
    expect(denialReasonLabel("regra_nova_x")).toBe("regra_nova_x");
  });
});
