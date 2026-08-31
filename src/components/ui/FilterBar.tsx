import type { ReactNode } from "react";

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
    <div className="flex flex-wrap items-end gap-3 border-b border-border-hairline bg-canvas-raised/40 px-5 py-3">
      {search && <div className="min-w-[12rem] flex-1">{search}</div>}
      <div className="flex flex-wrap items-end gap-3">{children}</div>
      {hasActiveFilters && onClear && (
        <button
          type="button"
          onClick={onClear}
          className="ml-auto shrink-0 rounded-sm px-2 py-1.5 text-2xs font-medium text-ink-muted transition-colors hover:text-accent"
        >
          Limpar filtros
        </button>
      )}
    </div>
  );
}
