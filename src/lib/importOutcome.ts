import type { BadgeTone } from "@/components/ui/Badge";

export type ImportOutcome = "importado" | "parcial" | "nada";

/**
 * UX-03: o selo de um arquivo diz o que entrou, não só que o processamento
 * terminou (antes, "Concluído/Processado" em verde com 100% rejeitado).
 */
export function importOutcome(rowCount: number | null | undefined, errorRowCount: number | null | undefined): ImportOutcome {
  const total = rowCount ?? 0;
  const errors = errorRowCount ?? 0;
  if (total > 0 && errors >= total) return "nada";
  if (errors > 0) return "parcial";
  return "importado";
}

export const OUTCOME_LABEL: Record<ImportOutcome, string> = {
  importado: "Importado",
  parcial: "Importado em parte",
  nada: "Nada importado",
};

export const OUTCOME_TONE: Record<ImportOutcome, BadgeTone> = {
  importado: "revenue",
  parcial: "pending",
  nada: "denied",
};

export function formatCount(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString("pt-BR");
}

/** "8.746 linhas" / "1 linha". */
export function plural(n: number | null | undefined, one: string, many: string): string {
  return `${formatCount(n)} ${(n ?? 0) === 1 ? one : many}`;
}

/** Resumo de uma linha do arquivo, em português comum. */
export function outcomeSentence(rowCount: number | null | undefined, errorRowCount: number | null | undefined): string {
  const total = rowCount ?? 0;
  const errors = errorRowCount ?? 0;
  const imported = Math.max(0, total - errors);
  const outcome = importOutcome(total, errors);
  if (outcome === "nada") return `Nada foi importado: ${plural(errors, "linha ficou", "linhas ficaram")} de fora.`;
  if (outcome === "parcial") return `${plural(imported, "linha entrou", "linhas entraram")}; ${plural(errors, "ficou", "ficaram")} de fora.`;
  return `${plural(imported, "linha importada", "linhas importadas")}.`;
}
