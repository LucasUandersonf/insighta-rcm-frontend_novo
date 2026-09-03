// Paleta de cores para gráficos Recharts — extraída de
// AgendaAnalyticsPanel.tsx para ser reutilizada por qualquer novo
// gráfico do Painel (ex: PlanLossRankingPanel), em vez de cada
// componente novo reinventar os mesmos hex/tokens por conta própria.
//
// Recharts exige cor literal em `style`/`stroke`/`fill` (não aceita
// classes Tailwind), então os valores replicam os tokens de
// tailwind.config.ts/index.css à mão — trocar um token lá exige trocar
// aqui também (não há como os dois nunca desalinharem sozinhos com
// CSS puro), mas concentrar num único arquivo pelo menos garante que
// só precisa trocar em UM lugar, não em cada gráfico.
export interface ChartPalette {
  tooltipBg: string;
  tooltipBorder: string;
  axis: string;
  grid: string;
  bar: string;
  barMuted: string;
  label: string;
  // Cor de "perda" (mesmo token --denied de RiskBadge/KpiCard tone="denied")
  // — usada em gráficos que representam dinheiro perdido/em risco, nunca
  // o `bar` de marca/positivo acima.
  loss: string;
}

export const CHART_PALETTE: Record<"dark" | "light", ChartPalette> = {
  dark: {
    tooltipBg: "#132436",
    tooltipBorder: "#182535",
    axis: "#7A8498",
    grid: "#1E2433",
    bar: "#16C98D",
    barMuted: "#1E2433",
    label: "#F5F7FA",
    loss: "hsl(0, 84%, 60%)", // --denied (tema escuro)
  },
  light: {
    tooltipBg: "#FFFFFF",
    tooltipBorder: "#D7DDE7",
    axis: "#586074",
    grid: "#E4E8EE",
    bar: "#0B8760",
    barMuted: "#E4E8EE",
    label: "#0B1420",
    loss: "hsl(0, 72%, 51%)", // --denied (tema claro)
  },
};
