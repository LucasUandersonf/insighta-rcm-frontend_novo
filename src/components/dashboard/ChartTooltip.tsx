// Tooltip custom do Recharts — extraída de AgendaAnalyticsPanel.tsx
// para reuso: substitui o `contentStyle` inline (que só estiliza a
// caixa) por um componente real, com o mesmo tratamento visual de card
// do resto da UI (borda fio-de-cabelo, sombra, tipografia consistente)
// em vez do balão genérico padrão do Recharts.
export function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-md border border-border-hairline bg-canvas-surface px-3 py-2 text-xs shadow-elevated">
      {label && <p className="mb-1 font-medium text-ink">{label}</p>}
      {payload.map((entry: { name: string; value: number; color: string }, i: number) => (
        <div key={i} className="flex items-center gap-1.5 text-ink-muted">
          <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
          {entry.name}: <span className="font-mono text-ink">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}
