import { expect, test } from "@playwright/test";
import fs from "node:fs";

/**
 * Homologação da V1 — varre as telas principais com a clínica criada pelo
 * teste de ponta a ponta do backend (app/scripts/e2e/run_e2e.py), logado
 * como o dono. Cada tela precisa: abrir sem erro de JavaScript, sem
 * resposta 5xx da API e sem a tela de "Algo deu errado". Tira uma captura
 * de cada tela em E2E_SHOTS_DIR para a revisão visual.
 *
 * Uso: E2E_EMAIL=... E2E_PASSWORD=... E2E_BASE_URL=http://localhost:5173 \
 *      npx playwright test e2e/homologacao.spec.ts --project=chromium-desktop
 */
const EMAIL = process.env.E2E_EMAIL ?? "";
const PASSWORD = process.env.E2E_PASSWORD ?? "";
const SHOTS = process.env.E2E_SHOTS_DIR ?? "test-results/homologacao";

const SCREENS: { path: string; name: string }[] = [
  { path: "/", name: "home" },
  { path: "/painel", name: "sala-de-comando" },
  { path: "/fila-correcao", name: "fila-de-correcao" },
  { path: "/faturamento", name: "faturamento" },
  { path: "/agenda-risco", name: "agenda-risco" },
  { path: "/appointments", name: "agendamentos" },
  { path: "/pacientes", name: "pacientes" },
  { path: "/contracts", name: "contratos" },
  { path: "/denial-appeals", name: "recursos-de-glosa" },
  { path: "/lotes", name: "lotes" },
  { path: "/upload", name: "central-de-upload" },
  { path: "/equipe", name: "equipe" },
  { path: "/meus-insights", name: "meus-insights" },
  { path: "/custos", name: "custos" },
  { path: "/marketing-spend", name: "marketing" },
  { path: "/decisao", name: "decisao" },
  { path: "/professionals", name: "profissionais" },
  { path: "/admin/saude-da-conta", name: "saude-da-conta" },
  { path: "/admin/tenant", name: "minha-clinica" },
  { path: "/admin/users", name: "usuarios" },
];

test.describe.configure({ mode: "serial" });

test("login e varredura das telas principais", async ({ page }) => {
  test.skip(!EMAIL || !PASSWORD, "E2E_EMAIL/E2E_PASSWORD não informados");
  test.setTimeout(10 * 60 * 1000);
  fs.mkdirSync(SHOTS, { recursive: true });

  const problems: string[] = [];
  let currentScreen = "login";
  page.on("pageerror", (err) => problems.push(`[${currentScreen}] erro de JavaScript: ${err.message}`));
  page.on("response", (res) => {
    if (res.url().includes("/api/") && res.status() >= 500) {
      problems.push(`[${currentScreen}] API ${res.status()} em ${new URL(res.url()).pathname}`);
    }
  });

  await page.goto("/login");
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 });

  for (const screen of SCREENS) {
    currentScreen = screen.name;
    await page.goto(screen.path);
    await page.waitForLoadState("networkidle", { timeout: 60_000 }).catch(() => undefined);
    const crashed = await page.getByText(/Algo deu errado/i).count();
    if (crashed) problems.push(`[${screen.name}] tela de erro "Algo deu errado"`);
    await page.screenshot({ path: `${SHOTS}/${screen.name}.png`, fullPage: true });
  }

  fs.writeFileSync(`${SHOTS}/problemas.json`, JSON.stringify(problems, null, 2));
  expect(problems, problems.join("\n")).toEqual([]);
});
