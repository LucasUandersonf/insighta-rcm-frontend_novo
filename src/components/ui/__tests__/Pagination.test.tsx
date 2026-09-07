import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Pagination } from "@/components/ui/Pagination";
import { expectNoA11yViolations } from "@/test/a11y";

describe("Pagination", () => {
  it("não renderiza nada quando total é zero", () => {
    const { container } = render(<Pagination total={0} limit={10} offset={0} onOffsetChange={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("mostra a faixa de itens exibida", () => {
    render(<Pagination total={42} limit={10} offset={10} onOffsetChange={() => {}} />);
    expect(screen.getByText("11")).toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("desabilita 'Página anterior' na primeira página e 'Próxima' na última", () => {
    const { rerender } = render(<Pagination total={30} limit={10} offset={0} onOffsetChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Página anterior" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Próxima página" })).toBeEnabled();

    rerender(<Pagination total={30} limit={10} offset={20} onOffsetChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Página anterior" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Próxima página" })).toBeDisabled();
  });

  it("clicar em 'Próxima página' avança o offset em um limit", async () => {
    const user = userEvent.setup();
    const onOffsetChange = vi.fn();
    render(<Pagination total={30} limit={10} offset={0} onOffsetChange={onOffsetChange} />);

    await user.click(screen.getByRole("button", { name: "Próxima página" }));
    expect(onOffsetChange).toHaveBeenCalledWith(10);
  });

  it("clicar num número de página vai direto para o offset daquela página", async () => {
    const user = userEvent.setup();
    const onOffsetChange = vi.fn();
    render(<Pagination total={30} limit={10} offset={0} onOffsetChange={onOffsetChange} />);

    await user.click(screen.getByRole("button", { name: "3" }));
    expect(onOffsetChange).toHaveBeenCalledWith(20);
  });

  it("marca a página atual com aria-current", () => {
    render(<Pagination total={30} limit={10} offset={10} onOffsetChange={() => {}} />);
    expect(screen.getByRole("button", { name: "2" })).toHaveAttribute("aria-current", "page");
  });

  it("não tem violações de acessibilidade", async () => {
    const { container } = render(<Pagination total={42} limit={10} offset={10} onOffsetChange={() => {}} />);
    await expectNoA11yViolations(container);
  });
});
