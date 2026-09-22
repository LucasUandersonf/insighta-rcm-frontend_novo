import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { TermsOfServicePage } from "@/pages/TermsOfServicePage";
import { PrivacyPolicyPage } from "@/pages/PrivacyPolicyPage";
import { renderWithProviders } from "@/test/utils";
import { expectNoA11yViolations } from "@/test/a11y";

/**
 * LGPD ("vamos chegar a 9.5") — cobertura mínima das páginas públicas de
 * texto jurídico: renderizam, mostram o aviso de rascunho em revisão
 * jurídica (nunca escondido do leitor, ver DECISÃO em
 * LegalDocumentLayout.tsx) e não quebram acessibilidade básica. O
 * conteúdo em si (idêntico a TERMOS_DE_USO.md/POLITICA_DE_PRIVACIDADE.md
 * no backend) não é testado frase a frase aqui — os dois documentos
 * precisam evoluir juntos, mas o teste de conteúdo estático não pega
 * divergência de texto de qualquer forma.
 */
describe("TermsOfServicePage", () => {
  it("renderiza o título e o aviso de rascunho em revisão jurídica", () => {
    renderWithProviders(<TermsOfServicePage />);
    expect(screen.getByRole("heading", { name: "Termos de Uso" })).toBeInTheDocument();
    expect(screen.getByText(/revisão jurídica/)).toBeInTheDocument();
  });

  it("não tem violações de acessibilidade", async () => {
    const { container } = renderWithProviders(<TermsOfServicePage />);
    await expectNoA11yViolations(container);
  });
});

describe("PrivacyPolicyPage", () => {
  it("renderiza o título e o aviso de rascunho em revisão jurídica", () => {
    renderWithProviders(<PrivacyPolicyPage />);
    expect(screen.getByRole("heading", { name: "Política de Privacidade" })).toBeInTheDocument();
    expect(screen.getByText(/revisão jurídica/)).toBeInTheDocument();
  });

  it("não tem violações de acessibilidade", async () => {
    const { container } = renderWithProviders(<PrivacyPolicyPage />);
    await expectNoA11yViolations(container);
  });
});
