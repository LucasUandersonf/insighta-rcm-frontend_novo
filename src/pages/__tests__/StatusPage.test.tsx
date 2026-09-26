import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { StatusPage } from "@/pages/StatusPage";
import { renderWithProviders } from "@/test/utils";

describe("StatusPage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("mostra tudo funcionando", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ api: "ok", database: "ok", worker: "ok", checked_at: "2026-09-26T12:00:00Z" }), { status: 200 }),
      ),
    );
    renderWithProviders(<StatusPage />);
    expect(await screen.findByText("Todos os serviços estão funcionando.")).toBeInTheDocument();
  });

  it("avisa quando as rotinas estão atrasadas", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ api: "ok", database: "ok", worker: "atrasado", checked_at: "2026-09-26T12:00:00Z" }), { status: 200 }),
      ),
    );
    renderWithProviders(<StatusPage />);
    expect(await screen.findByText(/Algum serviço está com problema/)).toBeInTheDocument();
    expect(screen.getByText("Com atraso")).toBeInTheDocument();
  });
});
