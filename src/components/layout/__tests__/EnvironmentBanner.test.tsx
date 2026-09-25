import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

async function renderBanner() {
  vi.resetModules();
  const { EnvironmentBanner } = await import("../EnvironmentBanner");
  return render(<EnvironmentBanner />);
}

describe("EnvironmentBanner", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    document.title = "Insighta";
  });

  it("não aparece em produção (sem VITE_APP_ENV)", async () => {
    vi.stubEnv("VITE_APP_ENV", "");
    document.title = "Insighta";
    const { container } = await renderBanner();
    expect(container).toBeEmptyDOMElement();
    expect(document.title).toBe("Insighta");
  });

  it("mostra a faixa e marca o título em homologação", async () => {
    vi.stubEnv("VITE_APP_ENV", "homologacao");
    document.title = "Insighta";
    await renderBanner();
    expect(screen.getByRole("status")).toHaveTextContent(/HOMOLOGAÇÃO/);
    expect(document.title).toBe("[HML] Insighta");
  });
});
