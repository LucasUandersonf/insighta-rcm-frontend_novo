import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { AuditLogPage } from "@/pages/admin/AuditLogPage";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import { expectNoA11yViolations } from "@/test/a11y";
import type { AuditLogEntry, PaginatedResponse } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

const ENTRIES: AuditLogEntry[] = [
  {
    id: 1,
    actor_user_id: "u1",
    actor_name: "Marina Souza",
    action: "created",
    entity_type: "patient",
    entity_id: "p1",
    diff: null,
    created_at: "2026-09-20T10:00:00Z",
  },
];

function mockPage(items: AuditLogEntry[] = ENTRIES): void {
  vi.mocked(apiClient.get).mockResolvedValue({ items, total: items.length, limit: 30, offset: 0 } as PaginatedResponse<AuditLogEntry>);
}

describe("AuditLogPage", () => {
  it("lista os eventos de auditoria retornados pela API", async () => {
    mockPage();
    renderWithProviders(<AuditLogPage />);

    expect(await screen.findByText("Marina Souza")).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Criação" })).toBeInTheDocument();
  });

  it("sem eventos, mostra o estado vazio", async () => {
    mockPage([]);
    renderWithProviders(<AuditLogPage />);

    expect(await screen.findByText("Nenhum evento de auditoria para os filtros atuais.")).toBeInTheDocument();
  });

  it("não tem violações de acessibilidade", async () => {
    mockPage();
    const { container } = renderWithProviders(<AuditLogPage />);

    await screen.findByText("Marina Souza");
    await expectNoA11yViolations(container);
  });
});
