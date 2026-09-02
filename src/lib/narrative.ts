/**
 * Geração de texto explicativo em PT-BR a partir de um KPI + variação —
 * determinística, baseada em limiares (SEM chamada de LLM), para o
 * requisito de "o sistema explica o número, não só mostra". Parametrizado
 * por `label`/`unit`/`shape` para ser reutilizável em qualquer métrica
 * (no-show, glosa, ocupação, faturamento etc), não hardcoded a uma só.
 */

export type MetricShape =
  | "currency" // moeda — mais é melhor (ex: faturamento)
  | "percentage-lower-is-better" // % onde cair é bom (ex: taxa de no-show, taxa de glosa)
  | "percentage-higher-is-better" // % onde subir é bom (ex: ocupação de agenda)
  | "duration"; // dias/horas — contexto neutro, sem "bom/ruim" automático

export interface DescribeTrendOptions {
  /** Unidade de exibição do delta (padrão: "pontos percentuais" p/ percentuais, "" p/ demais). */
  unit?: string;
  /** Atalho equivalente a shape="percentage-lower-is-better" quando true. */
  invertGood?: boolean;
  /** Forma do metric — controla o vocabulário da frase. Padrão: "percentage-higher-is-better". */
  shape?: MetricShape;
}

function formatDelta(deltaPct: number, unit: string): string {
  const abs = Math.abs(deltaPct);
  const formatted = abs.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return unit ? `${formatted} ${unit}` : `${formatted}%`;
}

/**
 * Gera uma frase em prosa (PT-BR) descrevendo a tendência de um KPI.
 *
 * @param label Nome da métrica como deve aparecer na frase (ex: "a taxa de no-show").
 * @param currentValue Valor atual do KPI (usado só para decidir "sem variação relevante" quando delta é ínfimo).
 * @param deltaPct Variação percentual vs. período anterior, ou null quando não há histórico suficiente.
 */
export function describeTrend(
  label: string,
  _currentValue: number,
  deltaPct: number | null,
  opts: DescribeTrendOptions = {},
): string {
  const shape: MetricShape = opts.shape ?? (opts.invertGood ? "percentage-lower-is-better" : "percentage-higher-is-better");
  const unit = opts.unit ?? (shape === "currency" || shape === "duration" ? "" : "pontos percentuais");

  if (deltaPct === null) {
    return `Ainda não há período anterior suficiente para comparar ${label}.`;
  }

  const abs = Math.abs(deltaPct);
  if (abs < 0.5) {
    return `${capitalize(label)} se manteve estável em relação ao período anterior.`;
  }

  const rising = deltaPct > 0;
  const magnitudeWord = abs >= 10 ? "expressiva" : abs >= 3 ? "relevante" : "leve";
  const deltaText = formatDelta(deltaPct, unit);

  // "lower is better": subir é ruim, cair é bom.
  if (shape === "percentage-lower-is-better") {
    return rising
      ? `${capitalize(label)} subiu ${deltaText} na última janela, uma alta ${magnitudeWord} que merece atenção.`
      : `${capitalize(label)} caiu ${deltaText} na última janela, uma melhora ${magnitudeWord}.`;
  }

  // "higher is better": subir é bom, cair é ruim.
  if (shape === "percentage-higher-is-better") {
    return rising
      ? `${capitalize(label)} subiu ${deltaText} na última janela, uma evolução ${magnitudeWord}.`
      : `${capitalize(label)} caiu ${deltaText} na última janela, uma queda ${magnitudeWord} que vale investigar.`;
  }

  if (shape === "currency") {
    return rising
      ? `${capitalize(label)} cresceu ${deltaText} em relação ao período anterior.`
      : `${capitalize(label)} recuou ${deltaText} em relação ao período anterior.`;
  }

  // duration — sem juízo de valor automático, só reporta o fato.
  return rising
    ? `${capitalize(label)} aumentou ${deltaText} em relação ao período anterior.`
    : `${capitalize(label)} diminuiu ${deltaText} em relação ao período anterior.`;
}

function capitalize(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Formato mínimo de um PeriodKPI (ver app/schemas/analytics.py) — só o
 * necessário para calcular a badge de tendência do KpiCard, sem acoplar
 * este módulo compartilhado ao tipo completo de src/lib/types.ts. */
export interface TrendableKpi {
  delta_pct: number | null;
}

/** Converte um PeriodKPI em badge de tendência do KpiCard (ver
 * KpiCard.tsx) — usado tanto na Sala de Comando quanto no Painel, os
 * dois consumindo os mesmos KPIs de /analytics/executive-summary.
 * `invert: true` para métricas onde CAIR é a boa notícia (ex: buraco
 * financeiro, glosa) — mesmo raciocínio de `invertGood` em describeTrend. */
export function trendFrom(kpi: TrendableKpi, opts?: { invert?: boolean }): { value: string; positive: boolean } | undefined {
  if (kpi.delta_pct === null) return undefined;
  const positive = opts?.invert ? kpi.delta_pct < 0 : kpi.delta_pct >= 0;
  return { value: `${Math.abs(kpi.delta_pct).toFixed(1)}% vs. período anterior`, positive };
}
