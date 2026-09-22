import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { ReportRecipientsPage } from "@/pages/admin/ReportRecipientsPage";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import { expectNoA11yViolations } from "@/test/a11y";
import type { ReportRecipient } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

const RECIPIENTS: ReportRecipient[] = [
  {
    id: "r1",
    name: "Marina Souza",
    phone_whatsapp: "+55 11 91234-5678",
    email: "marina@clinica.com",
    report_types: [],
    active: true,
    created_at: "2026-09-01T10:00:00Z",
    updated_at: "2026-09-01T10:00:00Z",
  },
];

describe("ReportRecipientsPage", () => {
  it("lista os destinatários cadastrados", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(RECIPIENTS as never);
    renderWithProviders(<ReportRecipientsPage />);

    expect(await screen.findByText("Marina Souza")).toBeInTheDocument();
  });

  it("não tem violações de acessibilidade", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(RECIPIENTS as never);
    const { container } = renderWithProviders(<ReportRecipientsPage />);

    await screen.findByText("Marina Souza");
    await expectNoA11yViolations(container);
  });
});
