import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { DenialAppealsPage } from "@/pages/DenialAppealsPage";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import { expectNoA11yViolations } from "@/test/a11y";
import type {
  AiGenerationJob,
  DenialAppeal,
  DenialAppealDraftJustificationResponse,
  PaginatedResponse,
} from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return {
    ...actual,
    apiClient: { ...actual.apiClient, get: vi.fn(), post: vi.fn(), getBlob: vi.fn() },
  };
});

function makeAppeal(overrides: Partial<DenialAppeal> = {}): DenialAppeal {
  return {
    id: "appeal-1",
    billing_id: "billing-1",
    appeal_type: "administrativa",
    operator_denial_reason: "Falta de guia de autorização prévia.",
    denied_at: "2026-09-01",
    deadline_at: "2026-09-20",
    status: "aberto",
    filed_at: null,
    resolution_notes: null,
    resolved_at: null,
    created_at: "2026-09-01T00:00:00Z",
    attachments: [],
    ...overrides,
  };
}

describe("DenialAppealsPage — rascunho de justificativa via IA (Parecer Técnico, revisão 2)", () => {
  it("gera rascunho com IA, permite editar, e baixa o PDF com a justificativa no query param", async () => {
    const appealsPage: PaginatedResponse<DenialAppeal> = { items: [makeAppeal()], total: 1, limit: 20, offset: 0 };

    // Achado 1.7 da Auditoria Implacável: o rascunho via IA agora é um
    // job assíncrono (POST enfileira, GET /ai-jobs/{id} faz polling) —
    // ver DECISÃO em app/sql/065_ai_generation_jobs.sql no backend.
    const draftResult: DenialAppealDraftJustificationResponse = {
      draft: "A guia foi corretamente autorizada sob o número 998877, conforme dados do caso.",
    };
    const completedJob: AiGenerationJob<DenialAppealDraftJustificationResponse> = {
      id: "draft-job-1",
      kind: "denial_appeal_draft",
      status: "completed",
      result: draftResult,
      error: null,
      created_at: "2026-09-01T00:00:00Z",
      completed_at: "2026-09-01T00:00:01Z",
    };
    vi.mocked(apiClient.get).mockImplementation((path: string) => {
      if (path.startsWith("/api/v1/ai-jobs/")) return Promise.resolve(completedJob as never);
      return Promise.resolve(appealsPage as never);
    });
    vi.mocked(apiClient.post).mockResolvedValue({ job_id: "draft-job-1", status: "pending" } as never);
    vi.mocked(apiClient.getBlob).mockResolvedValue(new Blob(["%PDF"], { type: "application/pdf" }) as never);

    // jsdom não implementa URL.createObjectURL/revokeObjectURL — precisa
    // existir antes de poder ser espionado com vi.spyOn.
    URL.createObjectURL = vi.fn();
    URL.revokeObjectURL = vi.fn();
    const createObjectURLSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:fake-url");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    renderWithProviders(<DenialAppealsPage />);
    await waitFor(() => expect(screen.getByText("Administrativa")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Documento" }));
    const modalTitle = await screen.findByText("Justificativa do recurso");
    const dialog = (modalTitle.closest('[role="dialog"]') ?? modalTitle.parentElement!) as HTMLElement;

    fireEvent.click(within(dialog).getByRole("button", { name: /Gerar rascunho/i }));

    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith("/api/v1/denial-appeals/appeal-1/draft-justification")
    );
    await waitFor(() =>
      expect(within(dialog).getByLabelText(/Justificativa/)).toHaveValue(draftResult.draft)
    );

    fireEvent.click(within(dialog).getByRole("button", { name: /Baixar documento/i }));

    await waitFor(() => expect(apiClient.getBlob).toHaveBeenCalled());
    const calledPath = vi.mocked(apiClient.getBlob).mock.calls[0][0];
    expect(calledPath).toContain("/api/v1/denial-appeals/appeal-1/document?justification=");
    const queryString = calledPath.split("?")[1];
    expect(new URLSearchParams(queryString).get("justification")).toBe(draftResult.draft);
    expect(createObjectURLSpy).toHaveBeenCalled();
    expect(openSpy).toHaveBeenCalled();
  });

  it("baixa o documento sem justificativa (placeholder padrão) quando o campo fica vazio", async () => {
    const appealsPage: PaginatedResponse<DenialAppeal> = { items: [makeAppeal()], total: 1, limit: 20, offset: 0 };
    vi.mocked(apiClient.get).mockResolvedValue(appealsPage as never);
    vi.mocked(apiClient.getBlob).mockResolvedValue(new Blob(["%PDF"], { type: "application/pdf" }) as never);
    URL.createObjectURL = vi.fn();
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:fake-url");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.spyOn(window, "open").mockImplementation(() => null);

    renderWithProviders(<DenialAppealsPage />);
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Documento" })[0]).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Documento" }));
    const modalTitle = await screen.findByText("Justificativa do recurso");
    const dialog = (modalTitle.closest('[role="dialog"]') ?? modalTitle.parentElement!) as HTMLElement;

    fireEvent.click(within(dialog).getByRole("button", { name: /Baixar documento/i }));

    await waitFor(() => expect(apiClient.getBlob).toHaveBeenCalledWith("/api/v1/denial-appeals/appeal-1/document"));
  });

  it("não tem violações de acessibilidade", async () => {
    const appealsPage: PaginatedResponse<DenialAppeal> = { items: [makeAppeal()], total: 1, limit: 20, offset: 0 };
    vi.mocked(apiClient.get).mockResolvedValue(appealsPage as never);

    const { container } = renderWithProviders(<DenialAppealsPage />);
    await waitFor(() => expect(screen.getByText("Administrativa")).toBeInTheDocument());

    await expectNoA11yViolations(container);
  });
});
