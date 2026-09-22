import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { PepConformidadePanel } from "@/components/dashboard/PepConformidadePanel";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import { expectNoA11yViolations } from "@/test/a11y";
import type { PepConformidade } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

describe("PepConformidadePanel", () => {
  it("mostra as 2 % de conformidade do PEP", async () => {
    const data: PepConformidade = {
      period_start: "2026-09-01",
      period_end: "2026-09-07",
      missing_documentation_count: 1,
      completed_encounters_count: 2,
      missing_documentation_pct: 50,
      missing_cid_count: 0,
      evolutions_count: 1,
      missing_cid_pct: 0,
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<PepConformidadePanel dateFrom="2026-09-01" dateTo="2026-09-07" />);

    await waitFor(() => expect(screen.getAllByText("50%").length).toBeGreaterThan(0));
    expect(screen.getAllByText("0%").length).toBeGreaterThan(0);
    expect(screen.getByText(/1 de 2 atendimento\(s\) concluído\(s\)/)).toBeInTheDocument();
  });

  it("travessão quando não há dado no período", async () => {
    const data: PepConformidade = {
      period_start: "2026-09-01",
      period_end: "2026-09-07",
      missing_documentation_count: 0,
      completed_encounters_count: 0,
      missing_documentation_pct: null,
      missing_cid_count: 0,
      evolutions_count: 0,
      missing_cid_pct: null,
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<PepConformidadePanel dateFrom="2026-09-01" dateTo="2026-09-07" />);

    const dashes = await screen.findAllByText("—");
    expect(dashes).toHaveLength(2);
  });

  it("não tem violações de acessibilidade", async () => {
    const data: PepConformidade = {
      period_start: "2026-09-01",
      period_end: "2026-09-07",
      missing_documentation_count: 1,
      completed_encounters_count: 2,
      missing_documentation_pct: 50,
      missing_cid_count: 0,
      evolutions_count: 1,
      missing_cid_pct: 0,
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    const { container } = renderWithProviders(<PepConformidadePanel dateFrom="2026-09-01" dateTo="2026-09-07" />);

    await waitFor(() => expect(screen.getAllByText("50%").length).toBeGreaterThan(0));
    await expectNoA11yViolations(container);
  });
});
