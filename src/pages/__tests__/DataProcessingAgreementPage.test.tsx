import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { DataProcessingAgreementPage } from "@/pages/DataProcessingAgreementPage";
import { TermsOfServicePage } from "@/pages/TermsOfServicePage";
import { renderWithProviders } from "@/test/utils";

describe("documentos legais", () => {
  it("contrato de dados lista o Asaas e mostra o que falta preencher", () => {
    renderWithProviders(<DataProcessingAgreementPage />);
    expect(screen.getByText("Asaas")).toBeInTheDocument();
    expect(screen.getAllByText(/\[a preencher: razão social\]/).length).toBeGreaterThan(0);
  });

  it("termos trazem a oferta Founders e o prazo de exportação", () => {
    renderWithProviders(<TermsOfServicePage />);
    expect(screen.getByText("R$ 800,00 por mês")).toBeInTheDocument();
    expect(screen.getByText(/por 90 dias depois do cancelamento/)).toBeInTheDocument();
  });
});
