import { describe, expect, it } from "vitest";
import { extractionPagesNote } from "@/pages/ContractsPage";

describe("extractionPagesNote", () => {
  it("diz quantas páginas precisaram de IA", () => {
    expect(extractionPagesNote(12, 3)).toBe("12 páginas lidas; 3 precisaram de IA.");
    expect(extractionPagesNote(1, 1)).toBe("1 página lida; 1 precisou de IA.");
    expect(extractionPagesNote(8, 0)).toBe("8 páginas lidas, sem precisar de IA.");
    expect(extractionPagesNote(5, undefined)).toBe("5 páginas lidas.");
  });
});
