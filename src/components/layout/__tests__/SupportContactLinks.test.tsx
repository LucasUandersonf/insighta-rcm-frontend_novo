import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { buildSupportContacts } from "@/lib/support";
import { SupportContactLinks } from "../SupportContactLinks";

describe("buildSupportContacts", () => {
  it("monta o link do WhatsApp só com dígitos e a mensagem pronta", () => {
    const c = buildSupportContacts("+55 (11) 99999-0000", "suporte@insighta.com.br");
    expect(c.whatsappUrl).toBe("https://wa.me/5511999990000?text=Ol%C3%A1!%20Preciso%20de%20ajuda%20com%20o%20Insighta.");
    expect(c.email).toBe("suporte@insighta.com.br");
  });

  it("ignora número curto e e-mail inválido", () => {
    expect(buildSupportContacts("1234", "nao-e-email")).toEqual({ whatsappUrl: null, email: null });
    expect(buildSupportContacts(undefined, undefined)).toEqual({ whatsappUrl: null, email: null });
  });
});

describe("SupportContactLinks", () => {
  it("não aparece quando o suporte não foi configurado", () => {
    const { container } = render(<SupportContactLinks contacts={{ whatsappUrl: null, email: null }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("mostra WhatsApp e e-mail quando configurados", () => {
    render(<SupportContactLinks contacts={buildSupportContacts("5511999990000", "suporte@insighta.com.br")} />);
    expect(screen.getByRole("link", { name: /whatsapp/i })).toHaveAttribute("href", expect.stringContaining("https://wa.me/5511999990000"));
    expect(screen.getByRole("link", { name: /suporte@insighta.com.br/ })).toHaveAttribute("href", "mailto:suporte@insighta.com.br");
  });

  it("versão curta para a tela de login", () => {
    render(<SupportContactLinks variant="inline" contacts={buildSupportContacts("5511999990000", undefined)} />);
    expect(screen.getByText(/precisa de ajuda/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /whatsapp/i })).toHaveAttribute("target", "_blank");
  });
});
