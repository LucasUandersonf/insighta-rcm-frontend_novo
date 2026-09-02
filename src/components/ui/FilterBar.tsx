import type { ReactNode } from "react";
import { X } from "lucide-react";

interface FilterBarProps {
  /** Controles de filtro (SelectField, TextField, date pickers etc.) — este componente não define nenhum campo específico. */
  children: ReactNode;
  /** Slot opcional para um input de busca livre, alinhado à esquerda dos demais filtros. */
  search?: ReactNode;
  /** Quando true, mostra o botão "Limpar filtros". */
  hasActiveFilters?: boolean;
  onClear?: () => void;
}

/** Shell genérico de barra de filtros avançados — só layout/comportamento
 * (alinhamento, wrap responsivo, botão de limpar condicional). Nenhum
 * campo de filtro é definido aqui; a página compõe com seus próprios
 * SelectField/TextField/date pickers. */
export function FilterBar({ children, search, hasActiveFilters, onClear }: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-end gap-3 border-b border-border-hairline bg-canvas-raised/40 px-5 py-3.5">
      {search && <div className="min-w-[12rem] flex-1">{search}</div>}
      <div className="flex flex-wrap items-end gap-3">{children}</div>
      {hasActiveFilters && onClear && (
        <button
          type="button"
          onClick={onClear}
          className="ml-auto flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-2xs font-medium text-ink-muted transition-colors hover:bg-canvas-raised hover:text-accent"
        >
          <X size={11} />
          Limpar filtros
        </button>
      )}
    </div>
  );
}
