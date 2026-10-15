import { describe, expect, it } from "vitest";
import { countCsvRows, importVolumeWarning } from "@/lib/plan";

describe("aviso de volume antes de importar", () => {
  it("conta as linhas de dados do CSV", () => {
    expect(countCsvRows("data;paciente\n01/10;A\n02/10;B\n\n")).toBe(2);
    expect(countCsvRows("data;paciente\r\n")).toBe(0);
  });

  it("não avisa quando cabe no limite ou o plano não tem limite", () => {
    expect(importVolumeWarning({ used: 100, limit: 1500, state: "ok" }, 200)).toBeNull();
    expect(importVolumeWarning({ used: 9000, limit: null, state: "ok" }, 5000)).toBeNull();
  });

  it("avisa quando o arquivo pode passar do limite e dos 120%", () => {
    const over = importVolumeWarning({ used: 1200, limit: 1500, state: "warn" }, 700);
    expect(over).toMatch(/Este arquivo tem 700 linhas/);
    expect(over).toMatch(/próximas ficam pausadas/);
    const within = importVolumeWarning({ used: 1200, limit: 1500, state: "warn" }, 400);
    expect(within).toMatch(/Até 1.800 \(120%\) as importações continuam/);
  });

  it("sem contar as linhas (xlsx), avisa só quando já está perto do limite", () => {
    expect(importVolumeWarning({ used: 100, limit: 1500, state: "ok" }, null)).toBeNull();
    expect(importVolumeWarning({ used: 1300, limit: 1500, state: "warn" }, null)).toMatch(/1.300 de 1.500/);
    expect(importVolumeWarning({ used: 1900, limit: 1500, state: "blocked" }, 10)).toMatch(/Importação pausada/);
  });
});
