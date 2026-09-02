import { ChevronDown } from "lucide-react";
import { DEFAULT_WINDOW_OPTIONS, type WindowOption } from "@/lib/useDateWindow";

/** Seletor de janela de período (dropdown "Últimos N dias") — mesmo
 * controle usado por Sala de Comando e Painel, extraído para os dois
 * nunca desalinharem visualmente (era duplicado antes do Painel também
 * precisar de filtro de período). */
export function PeriodWindowSelect({
  windowDays,
  onChange,
  options = DEFAULT_WINDOW_OPTIONS,
}: {
  windowDays: number;
  onChange: (days: number) => void;
  options?: WindowOption[];
}) {
  return (
    <div className="relative w-52">
      <select
        aria-label="Janela de período"
        value={windowDays}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full appearance-none rounded-md border border-border-subtle bg-canvas-surface py-2 pl-3.5 pr-9 text-sm text-ink shadow-card transition-colors hover:border-border focus:border-revenue"
      >
        {options.map((opt) => (
          <option key={opt.days} value={opt.days}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown aria-hidden size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint" />
    </div>
  );
}
