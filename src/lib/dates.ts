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

const CLINIC_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * "AAAA-MM-DD" do dia em Brasília (UX3-09). `toISOString()` usa o dia em
 * UTC: depois das 21h já é "amanhã", e o próprio sistema recusava a data
 * que tinha sugerido ("não pode estar no futuro").
 */
export function clinicIsoDate(d: Date = new Date()): string {
  return CLINIC_DAY.format(d);
}

/** Soma `days` (pode ser negativo) a uma data "AAAA-MM-DD". */
export function addDaysIso(iso: string, days: number): string {
  const d = parseApiDate(iso);
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
