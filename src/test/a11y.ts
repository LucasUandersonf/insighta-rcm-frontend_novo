/**
 * src/test/a11y.ts — checagem automatizada de acessibilidade via
 * axe-core, para regressão contínua (ver README, seção "Acessibilidade").
 *
 * DECISÃO — "color-contrast" desligado aqui
 * -------------------------------------------------------------------
 * jsdom não calcula layout/estilo computado real (não é um motor de
 * renderização) — a regra de contraste de cor do axe depende disso pra
 * funcionar e, sob jsdom, produz falso positivo/negativo o tempo todo
 * (não avalia a cor de fato aplicada, só o que está no DOM). Contraste
 * de cor real precisa de um navegador de verdade (Playwright) — fora do
 * escopo desta rodada, documentado como pendência formal, não escondido.
 * Todas as outras ~90 regras do axe (nome acessível, papel ARIA válido,
 * label associado, ordem de heading, etc.) funcionam normalmente em
 * jsdom e continuam ativas aqui.
 */
import { run, type RunOptions } from "axe-core";

const DEFAULT_OPTIONS: RunOptions = {
  rules: {
    "color-contrast": { enabled: false },
  },
};

export async function expectNoA11yViolations(container: Element, options: RunOptions = DEFAULT_OPTIONS): Promise<void> {
  const results = await run(container, options);
  if (results.violations.length > 0) {
    const details = results.violations
      .map((v) => {
        const targets = v.nodes.map((n) => n.target.join(" ")).join(", ");
        return `- [${v.impact}] ${v.id}: ${v.help}\n  elementos: ${targets}\n  ${v.helpUrl}`;
      })
      .join("\n");
    throw new Error(`Violações de acessibilidade encontradas (axe-core):\n${details}`);
  }
}
