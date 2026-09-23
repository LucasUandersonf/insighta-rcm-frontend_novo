import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { DenialModelStatusNote, denialModelNote } from "@/components/dashboard/DenialModelStatusNote";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import type { DenialModelStatus } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

const base: DenialModelStatus = { status: "aprendendo", samples: 12, denied: 2, not_denied: 10, min_samples: 30, min_class_samples: 5 };

describe("DenialModelStatusNote", () => {
  it("mostra 'modelo em aprendizado: X de 30' com o que falta", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(base);
    renderWithProviders(<DenialModelStatusNote />);
    expect(
      await screen.findByText(
        "Modelo em aprendizado: 12 de 30 cobranças (2 de 5 glosas mínimas). Até lá, o risco de glosa usa só as regras do contrato."
      )
    ).toBeInTheDocument();
  });

  it("descreve os estados pronto e ativo", () => {
    expect(denialModelNote({ ...base, status: "pronto_para_treinar", samples: 40, denied: 8 })).toMatch(/pronto para treinar: 40 cobranças/);
    expect(denialModelNote({ ...base, status: "ativo" })).toMatch(/^Modelo de glosa ativo/);
  });
});
