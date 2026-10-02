import { describe, expect, it } from "vitest";
import { passwordProblem } from "@/lib/password";

describe("passwordProblem (mesma regra do backend)", () => {
  it.each([
    ["curta1", /pelo menos 8/],
    ["somenteletras", /uma letra e um número ou símbolo/],
    ["12345678", /uma letra e um número ou símbolo/],
    ["senha123", /muito comum/],
    ["a1".repeat(65), /no máximo 128/],
  ])("recusa %s", (pwd, msg) => {
    expect(passwordProblem(pwd)).toMatch(msg);
  });

  it.each(["Clinica@2026", "boa-senha-longa!", "ação9xyz"])("aceita %s", (pwd) => {
    expect(passwordProblem(pwd)).toBeNull();
  });
});
