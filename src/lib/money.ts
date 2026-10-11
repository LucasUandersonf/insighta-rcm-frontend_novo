/**
 * Valores em reais digitados pelo usuário.
 *
 * Auditoria de UX: "2.400.000,00" na meta anual virava R$ 2,40 porque o
 * campo trocava só a primeira vírgula por ponto e `Number()` aceitava o que
 * sobrava. As regras aqui são as MESMAS do backend (app/core/money.py), que
 * continua sendo a validação de verdade:
 *
 * - vírgula é decimal e ponto é milhar em grupos de 3 ("2.400.000,00");
 * - sem vírgula, ponto seguido de 3 dígitos é milhar ("2.400" = 2400) e
 *   ponto seguido de 1 ou 2 dígitos é decimal ("1250.5", valor colado de
 *   outro sistema);
 * - o que não se encaixa é recusado com mensagem, nunca adivinhado.
 *
 * Para a API vai o texto normalizado ("2400000.00"), não um float.
 */

const BR_WITH_COMMA = /^\d{1,3}(?:\.\d{3})*,\d{1,2}$|^\d+,\d{1,2}$/;
const BR_THOUSANDS_ONLY = /^\d{1,3}(?:\.\d{3})+$/;
const DOT_DECIMAL = /^\d+(?:\.\d{1,2})?$/;

/** Maior valor que cabe nas colunas de dinheiro do banco (Numeric(12, 2)). */
export const MAX_MONEY = 9_999_999_999.99;

export type MoneyParse =
  | { ok: true; value: number; normalized: string }
  | { ok: false; error: string };

export function parseMoneyBR(input: string): MoneyParse {
  const text = input
    .trim()
    .replace(/^R\$\s*/i, "")
    .replace(/[\s\u00a0]/g, "");
  if (!text) return { ok: false, error: "Informe um valor." };

  let normalized: string;
  if (BR_WITH_COMMA.test(text)) {
    normalized = text.replace(/\./g, "").replace(",", ".");
  } else if (BR_THOUSANDS_ONLY.test(text)) {
    normalized = text.replace(/\./g, "");
  } else if (DOT_DECIMAL.test(text)) {
    normalized = text;
  } else {
    return { ok: false, error: `“${input.trim()}” não é um valor válido. Use o formato 2.400.000,00.` };
  }

  const [intPart, decPart = ""] = normalized.split(".");
  const cents = `${intPart.replace(/^0+(?=\d)/, "")}.${decPart.padEnd(2, "0")}`;
  const value = Number(cents);
  if (value > MAX_MONEY) return { ok: false, error: "Valor alto demais. Confira se não há zeros a mais." };
  return { ok: true, value, normalized: cents };
}

const BRL_NUMBER = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 2400000 -> "2.400.000,00" (sem o "R$", para dentro do campo). */
export function formatMoneyInput(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isFinite(value) ? "" : BRL_NUMBER.format(value);
}
