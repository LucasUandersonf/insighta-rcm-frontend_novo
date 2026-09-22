import { defineConfig, devices } from "@playwright/test";

/**
 * playwright.config.ts — auditoria de acessibilidade REAL de navegador
 * (UX/acessibilidade "vamos chegar a 9.5"). Complementa, não substitui,
 * os testes jsdom em src/pages/**\/__tests__ (ver DECISÃO em
 * src/test/a11y.ts): jsdom não calcula layout/estilo computado, então a
 * regra "color-contrast" do axe fica desligada lá — aqui, rodando contra
 * um Chromium de verdade, ela roda com o ruleset COMPLETO.
 *
 * Sem `webServer` de propósito: os testes em e2e/ dependem de dado
 * demo real (backend + Postgres + tenant semeado via
 * scripts/seed_demo_data.py) — não dá pra subir isso automaticamente a
 * cada `playwright test` sem reimplementar o setup do backend aqui.
 * `baseURL` aponta pro dev server (`npm run dev`), que precisa estar de
 * pé manualmente (ou via CI, num job dedicado) antes de rodar.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium-desktop", use: { ...devices["Desktop Chrome"], launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } } },
    { name: "chromium-mobile", use: { ...devices["Pixel 7"], launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } } },
  ],
});
