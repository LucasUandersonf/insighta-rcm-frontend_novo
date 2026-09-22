import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { RegisterOutreachButton } from "@/components/dashboard/RegisterOutreachButton";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import { expectNoA11yViolations } from "@/test/a11y";
import type { PatientOutreachLogEntry } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, post: vi.fn() } };
});

function makeEntry(): PatientOutreachLogEntry {
  return {
    id: "log-1",
    patient_id: "p1",
    channel: "telefone",
    outcome: "agendou",
    notes: null,
    created_by: "u1",
    created_at: "2026-01-07T00:00:00Z",
  };
}

describe("RegisterOutreachButton", () => {
  it("abre o modal, preenche canal/resultado e envia o registro de contato", async () => {
    vi.mocked(apiClient.post).mockResolvedValue(makeEntry());

    renderWithProviders(<RegisterOutreachButton patientId="p1" patientName="Paciente Teste" invalidateKeys={[["analytics", "inactive-patients"]]} />);

    fireEvent.click(screen.getByRole("button", { name: /Registrar contato/ }));
    const modalTitle = await screen.findByRole("heading", { name: "Registrar contato — Paciente Teste" });
    const dialog = (modalTitle.closest('[role="dialog"]') ?? modalTitle.parentElement!) as HTMLElement;

    fireEvent.change(within(dialog).getByLabelText(/Canal/), { target: { value: "telefone" } });
    fireEvent.change(within(dialog).getByLabelText(/Resultado/), { target: { value: "agendou" } });
    fireEvent.change(within(dialog).getByLabelText(/Observações/), { target: { value: "Vai voltar semana que vem" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Registrar" }));

    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith(
        "/api/v1/patients/p1/outreach-log",
        expect.objectContaining({ channel: "telefone", outcome: "agendou", notes: "Vai voltar semana que vem" })
      )
    );
  });

  it("não tem violações de acessibilidade", async () => {
    vi.mocked(apiClient.post).mockResolvedValue(makeEntry());

    const { container } = renderWithProviders(
      <RegisterOutreachButton patientId="p1" patientName="Paciente Teste" invalidateKeys={[["analytics", "inactive-patients"]]} />
    );

    fireEvent.click(screen.getByRole("button", { name: /Registrar contato/ }));
    await screen.findByRole("heading", { name: "Registrar contato — Paciente Teste" });

    await expectNoA11yViolations(container);
  });
});
