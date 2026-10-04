import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReportRecipientsPage } from "@/pages/admin/ReportRecipientsPage";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import { expectNoA11yViolations } from "@/test/a11y";
import type { ReportRecipient } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn(), post: vi.fn() } };
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

  it("rodada 8 (A2): e-mail ainda não confirmado aparece como pendente e permite reenviar o link", async () => {
    const pending = { ...RECIPIENTS[0], id: "r2", name: "Contadora", email: "contadora@example.com", email_confirmed_at: null, email_confirmation_sent_at: "2026-10-04T10:00:00Z" };
    vi.mocked(apiClient.get).mockResolvedValue([{ ...RECIPIENTS[0], email_confirmed_at: "2026-09-01T10:00:00Z" }, pending] as never);
    vi.mocked(apiClient.post).mockResolvedValue(pending as never);
    const user = userEvent.setup();
    renderWithProviders(<ReportRecipientsPage />);

    await screen.findByText("Contadora");
    expect(screen.getAllByText("Aguardando confirmação")).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Reenviar link" }));
    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith("/api/v1/report-recipients/r2/resend-confirmation", {}),
    );
  });
});
