/**
 * Datas vindas da API, em um lugar só (UX2-11).
 *
 * `new Date("2026-01-01")` é meia-noite em UTC: no Brasil (UTC-3) vira
 * 31/12/2025 às 21h, e a tela mostrava a vigência de um contrato um dia
 * antes. Data sem hora ("AAAA-MM-DD") é lida como dia local; data com
 * hora (ISO completo) continua sendo um instante e é mostrada no fuso do
 * navegador.
 */
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseApiDate(value: string): Date {
  const m = DATE_ONLY.exec(value);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
}

const DEFAULT_OPTIONS: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", year: "numeric" };

/** "2026-01-01" -> "01/01/2026". Vazio ou inválido -> `fallback`. */
export function formatDateBR(
  value: string | null | undefined,
  options: Intl.DateTimeFormatOptions = DEFAULT_OPTIONS,
  fallback = "—"
): string {
  if (!value) return fallback;
  const date = parseApiDate(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat("pt-BR", options).format(date);
}
