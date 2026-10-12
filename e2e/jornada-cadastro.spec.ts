import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * S6 — jornada de primeiro uso, de ponta a ponta, num navegador de verdade:
 * cadastro da clínica → importação de uma planilha de faturamento → Sala de
 * Comando mostrando os números importados. Roda no CI do backend contra a
 * API real (bootstrap de produção num Postgres vazio, ver .github/workflows
 * do backend, job "e2e-navegador"). Localmente:
 *
 *   E2E_BASE_URL=http://localhost:5173 npx playwright test e2e/jornada-cadastro.spec.ts --project=chromium-desktop
 *
 * Cada execução cria uma clínica nova (CNPJ e e-mail únicos) — nunca
 * apontar para a produção.
 */
const FIXTURE = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "faturamento-jornada.csv");

function cnpjValido(): string {
  const base = Array.from({ length: 8 }, () => Math.floor(Math.random() * 10)).concat([0, 0, 0, 1]);
  const dv = (nums: number[]) => {
    const pesos = nums.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = nums.reduce((acc, n, i) => acc + n * pesos[i], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const d1 = dv(base);
  const d2 = dv([...base, d1]);
  return [...base, d1, d2].join("");
}

function collectProblems(page: Page): string[] {
  const problems: string[] = [];
  page.on("pageerror", (err) => problems.push(`erro de JavaScript: ${err.message}`));
  page.on("response", (res) => {
    if (res.url().includes("/api/") && res.status() >= 500) {
      problems.push(`API ${res.status()} em ${new URL(res.url()).pathname}`);
    }
  });
  return problems;
}

test("cadastro → importação → Sala de Comando", async ({ page }) => {
  test.setTimeout(4 * 60 * 1000);
  const problems = collectProblems(page);
  const stamp = Date.now();
  const email = `jornada.${stamp}@clinica-e2e.com.br`;
  const senha = `Jornada#${stamp}`;

  // 1) Cadastro
  await page.goto("/signup");
  await page.getByLabel("Nome da clínica").fill(`Clínica Jornada ${stamp}`);
  await page.getByLabel("CNPJ").fill(cnpjValido());
  await page.getByLabel("Seu nome completo").fill("Marina Jornada");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(senha);
  await page.getByLabel("Confirmar senha").fill(senha);
  // Passo 2: plano (o recomendado já vem marcado) e aceite dos termos.
  await page.getByRole("button", { name: /continuar|próximo|avançar/i }).first().click();
  await page.locator("#terms_accepted").check();
  await page.locator('button[type="submit"]').last().click();
  await page.waitForURL((u) => !u.pathname.startsWith("/signup"), { timeout: 30_000 });

  // Tour de boas-vindas: pula assim que aparecer, para não cobrir a tela.
  await page.addLocatorHandler(page.getByText("Pular tour"), async () => {
    await page.getByText("Pular tour").click();
  });

  // 2) Importação da planilha de faturamento
  await page.goto("/upload");
  await page.locator('input[type="file"]').first().setInputFiles(FIXTURE);
  await page.getByRole("button", { name: /enviar arquivo/i }).first().click();
  // O arquivo aparece no histórico como processado (e o aviso de "não
  // enviado" nunca aparece).
  const row = page.getByRole("row", { name: /faturamento-jornada\.csv/ });
  await expect(row).toBeVisible({ timeout: 90_000 });
  await expect(row.getByText("Importado")).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText(/Não enviado:/)).toHaveCount(0);
  await expect(page.getByText(/nenhum dado importado ainda/i)).toHaveCount(0, { timeout: 30_000 });

  // 3) Sala de Comando com os números da planilha
  await page.goto("/decisao");
  await page.waitForLoadState("networkidle");
  await expect(page.getByText(/R\$\s?[1-9]/).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Algo deu errado/i)).toHaveCount(0);

  expect(problems, problems.join("\n")).toEqual([]);
});
