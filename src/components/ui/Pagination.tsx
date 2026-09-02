import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

interface PaginationProps {
  /** Total de itens (não de páginas). */
  total: number;
  /** Itens por página. */
  limit: number;
  /** Offset atual (0-based). */
  offset: number;
  onOffsetChange: (offset: number) => void;
}

/** Controle de paginação genérico — "Mostrando X–Y de Z" + anterior/próxima
 * + números de página, sem dado embutido (consumidor injeta total/limit/offset
 * vindos da resposta paginada do backend). */
export function Pagination({ total, limit, offset, onOffsetChange }: PaginationProps) {
  if (total <= 0 || limit <= 0) return null;

  const pageCount = Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.min(pageCount, Math.floor(offset / limit) + 1);
  const rangeStart = total === 0 ? 0 : offset + 1;
  const rangeEnd = Math.min(total, offset + limit);

  const canPrev = currentPage > 1;
  const canNext = currentPage < pageCount;

  function goToPage(page: number) {
    const clamped = Math.min(Math.max(page, 1), pageCount);
    onOffsetChange((clamped - 1) * limit);
  }

  // Janela de páginas visíveis ao redor da atual (máx. 5 números), pra
  // não estourar a barra em listas com muitas páginas.
  const windowSize = 5;
  let start = Math.max(1, currentPage - Math.floor(windowSize / 2));
  const end = Math.min(pageCount, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);
  const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);

  return (
    <nav
      aria-label="Paginação"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-border-hairline px-5 py-3.5"
    >
      <p className="text-2xs text-ink-faint">
        Mostrando <span className="font-medium text-ink-muted">{rangeStart}</span>–<span className="font-medium text-ink-muted">{rangeEnd}</span> de{" "}
        <span className="font-medium text-ink-muted">{total}</span>
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => goToPage(currentPage - 1)}
          disabled={!canPrev}
          aria-label="Página anterior"
          className="flex items-center gap-1 rounded-md border border-border-subtle px-2 py-1 text-2xs text-ink-muted transition-colors hover:border-accent/40 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft size={12} />
          Anterior
        </button>
        {start > 1 && <span className="px-1 text-2xs text-ink-faint">…</span>}
        {pages.map((page) => (
          <button
            key={page}
            type="button"
            onClick={() => goToPage(page)}
            aria-current={page === currentPage ? "page" : undefined}
            className={cn(
              "min-w-[1.75rem] rounded-md border px-2 py-1 text-2xs transition-colors",
              page === currentPage
                ? "border-accent/40 bg-accent-bg text-accent"
                : "border-border-subtle text-ink-muted hover:border-accent/40 hover:text-ink"
            )}
          >
            {page}
          </button>
        ))}
        {end < pageCount && <span className="px-1 text-2xs text-ink-faint">…</span>}
        <button
          type="button"
          onClick={() => goToPage(currentPage + 1)}
          disabled={!canNext}
          aria-label="Próxima página"
          className="flex items-center gap-1 rounded-md border border-border-subtle px-2 py-1 text-2xs text-ink-muted transition-colors hover:border-accent/40 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          Próxima
          <ChevronRight size={12} />
        </button>
      </div>
    </nav>
  );
}
