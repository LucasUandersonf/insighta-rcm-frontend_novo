import { useState } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tabs, TabPanel } from "@/components/ui/Tabs";
import { expectNoA11yViolations } from "@/test/a11y";

const ITEMS = [
  { id: "faq", label: "Perguntas frequentes" },
  { id: "ask", label: "Enviar pergunta" },
  { id: "history", label: "Histórico" },
];

function ControlledTabs() {
  const [active, setActive] = useState("faq");
  return (
    <div>
      <Tabs items={ITEMS} active={active} onChange={setActive} groupId="test" />
      <TabPanel id={active} groupId="test">
        conteúdo de {active}
      </TabPanel>
    </div>
  );
}

describe("Tabs", () => {
  it("marca a aba ativa com aria-selected e mostra o conteúdo correspondente", () => {
    render(<ControlledTabs />);
    expect(screen.getByRole("tab", { name: "Perguntas frequentes" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Enviar pergunta" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByText("conteúdo de faq")).toBeInTheDocument();
  });

  it("clicar numa aba troca a aba ativa", async () => {
    const user = userEvent.setup();
    render(<ControlledTabs />);
    await user.click(screen.getByRole("tab", { name: "Enviar pergunta" }));
    expect(screen.getByRole("tab", { name: "Enviar pergunta" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("conteúdo de ask")).toBeInTheDocument();
  });

  // Achado do Laudo de Vistoria Técnica (parecer UX/acessibilidade): o
  // padrão WAI-ARIA de tablist espera navegação por seta entre abas —
  // corrigido com tabindex circulante + handlers de teclado em Tabs.tsx.
  it("Seta-Direita move o foco e ativa a próxima aba, Seta-Esquerda volta", async () => {
    const user = userEvent.setup();
    render(<ControlledTabs />);

    screen.getByRole("tab", { name: "Perguntas frequentes" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Enviar pergunta" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Enviar pergunta" })).toHaveFocus();

    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "Perguntas frequentes" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Perguntas frequentes" })).toHaveFocus();
  });

  it("Seta-Direita na última aba dá a volta para a primeira (circular)", async () => {
    const user = userEvent.setup();
    render(<ControlledTabs />);

    screen.getByRole("tab", { name: "Histórico" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Perguntas frequentes" })).toHaveAttribute("aria-selected", "true");
  });

  it("End vai para a última aba, Home volta para a primeira", async () => {
    const user = userEvent.setup();
    render(<ControlledTabs />);

    screen.getByRole("tab", { name: "Perguntas frequentes" }).focus();
    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Histórico" })).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{Home}");
    expect(screen.getByRole("tab", { name: "Perguntas frequentes" })).toHaveAttribute("aria-selected", "true");
  });

  it("só a aba ativa fica no fluxo normal de Tab (tabindex circulante)", () => {
    render(<ControlledTabs />);
    expect(screen.getByRole("tab", { name: "Perguntas frequentes" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("tab", { name: "Enviar pergunta" })).toHaveAttribute("tabindex", "-1");
  });

  it("não tem violações de acessibilidade", async () => {
    const { container } = render(<ControlledTabs />);
    await expectNoA11yViolations(container);
  });
});
