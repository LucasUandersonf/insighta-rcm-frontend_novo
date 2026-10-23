import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KpiCard } from "@/components/ui/KpiCard";
import { METRIC_HELP } from "@/lib/metricHelp";

describe("InfoTip nos indicadores", () => {
  it("KpiCard com rótulo conhecido mostra como calculamos", async () => {
    render(<KpiCard label="Cobrado abaixo do contrato" value="R$ 1.200" />);
    const button = screen.getByRole("button", { name: "Como calculamos: Cobrado abaixo do contrato" });
    await userEvent.click(button);
    expect(screen.getByRole("tooltip")).toHaveTextContent(METRIC_HELP["Cobrado abaixo do contrato"]);
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("rótulo sem explicação não mostra o ícone", () => {
    render(<KpiCard label="Número qualquer" value="3" />);
    expect(screen.queryByRole("button", { name: /Como calculamos/ })).not.toBeInTheDocument();
  });
});
