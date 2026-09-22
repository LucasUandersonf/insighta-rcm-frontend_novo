import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * QA visual + responsivo real da Sala de Comando (UX/acessibilidade "vamos
 * chegar a 9.5") — roda axe-core num Chromium de verdade (ruleset completo,
 * incluindo "color-contrast", que os testes jsdom em src/**\/__tests__
 * desligam de propósito por não terem layout real — ver src/test/a11y.ts).
 *
 * Precisa de um tenant demo real logado (backend + Postgres com dado
 * semeado via `python -m scripts.seed_demo_data`) — sem isso os KPIs
 * renderizam vazios e o teste não reflete o estado real das 11 abas.
 * Credenciais via env (nunca hardcoded): E2E_OWNER_EMAIL / E2E_OWNER_PASSWORD.
 */

const TABS = [
  "hoje",
  "diagnostico",
  "crm",
  "oportunidades",
  "comparativo",
  "rentabilidade",
  "simulador",
  "capital",
  "roi",
  "estoque",
  "clinico",
] as const;

const TAB_LABELS: Record<(typeof TABS)[number], string> = {
  hoje: "Hoje",
  diagnostico: "Diagnóstico",
  crm: "CRM",
  oportunidades: "Oportunidades",
  comparativo: "Comparativo",
  rentabilidade: "Rentabilidade",
  simulador: "Simulador",
  capital: "Capital",
  roi: "ROI",
  estoque: "Estoque",
  clinico: "Clínico",
};

const OWNER_EMAIL = process.env.E2E_OWNER_EMAIL;
const OWNER_PASSWORD = process.env.E2E_OWNER_PASSWORD;

test.skip(!OWNER_EMAIL || !OWNER_PASSWORD, "E2E_OWNER_EMAIL / E2E_OWNER_PASSWORD não configurados — pule este spec fora de uma rodada de QA manual com tenant demo.");

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(OWNER_EMAIL!);
  await page.getByLabel("Senha").fill(OWNER_PASSWORD!);
  await page.getByRole("button", { name: "Entrar no sistema" }).click();
  await page.waitForURL("**/decisao");
}

for (const tabId of TABS) {
  test(`aba "${TAB_LABELS[tabId]}" — sem violações de acessibilidade (ruleset completo)`, async ({ page }) => {
    await login(page);

    if (tabId !== "hoje") {
      await page.getByRole("tab", { name: TAB_LABELS[tabId] }).click();
    }
    await expect(page.getByRole("tabpanel", { name: TAB_LABELS[tabId] })).toBeVisible();
    // Dá tempo pros paineis com fetch assíncrono (recharts, animações)
    // assentarem antes do axe rodar — evita falso positivo de "conteúdo
    // ainda carregando" sendo lido como violação de contraste/estrutura.
    await page.waitForTimeout(800);

    const results = await new AxeBuilder({ page }).include('[role="tabpanel"]').analyze();

    if (results.violations.length > 0) {
      const summary = results.violations
        .map(
          (v) =>
            `[${v.impact}] ${v.id}: ${v.description}\n` +
            v.nodes.map((n) => `  - ${n.target.join(" ")}\n    ${n.failureSummary}\n    html: ${n.html.slice(0, 200)}`).join("\n")
        )
        .join("\n");
      throw new Error(`Violações de acessibilidade na aba "${TAB_LABELS[tabId]}":\n${summary}`);
    }

    await page.screenshot({ path: `e2e-screenshots/${tabId}-${test.info().project.name}.png`, fullPage: true });
  });
}
