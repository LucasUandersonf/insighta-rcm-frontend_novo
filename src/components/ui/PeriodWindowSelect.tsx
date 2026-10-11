import { useRef } from "react";
import { ChevronDown } from "lucide-react";
import { DEFAULT_WINDOW_OPTIONS, type WindowOption } from "@/lib/useDateWindow";
import { useOnline } from "@/lib/useOnline";

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
  // UX2-25: sem internet, trocar o período não busca nada novo — os números
  // na tela continuam os do período anterior. Diz isso em vez de deixar
  // parecer que já são do período escolhido.
  const online = useOnline();
  const lastLoaded = useRef(windowDays);
  if (online) lastLoaded.current = windowDays;
  const stale = !online && lastLoaded.current !== windowDays;
  const staleLabel = options.find((o) => o.days === lastLoaded.current)?.label ?? `${lastLoaded.current} dias`;
  return (
    <div className="relative w-48">
      {stale && (
        <p role="status" className="absolute right-0 top-full z-10 mt-1 w-64 rounded-md border border-pending/30 bg-pending-bg px-2.5 py-1.5 text-2xs text-pending">
          Sem conexão: não deu para atualizar. Os números na tela ainda são de “{staleLabel}”.
        </p>
      )}
      <select
        aria-label="Janela de período"
        value={windowDays}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-[38px] w-full appearance-none rounded-[11px] border border-border-hairline bg-canvas-raised/40 pl-3.5 pr-9 text-[13px] text-ink transition-colors hover:bg-canvas-raised/70 focus:border-accent"
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
