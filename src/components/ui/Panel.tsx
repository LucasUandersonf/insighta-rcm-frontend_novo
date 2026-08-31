import type { ReactNode } from "react";

/** Card de conteúdo padrão — borda fio de cabelo + sombra suave (ver
 * shadow-card em tailwind.config.ts), tipografia de header refinada.
 * `actions` é um slot extra ao lado de `action` para filtros/botões
 * secundários no header (ex: FilterBar) sem quebrar quem já usa `action`. */
export function Panel({
  title,
  subtitle,
  action,
  actions,
  children,
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  /** Slot adicional no header, ao lado de `action` (ex: barra de filtros, ações em lote). */
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border-hairline bg-canvas-surface/80 shadow-card backdrop-blur-sm">
      {(title || subtitle || action || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-hairline px-5 py-4">
          <div>
            {title && <h2 className="font-serif text-base font-medium tracking-premium text-ink">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-2xs text-ink-faint">{subtitle}</p>}
          </div>
          {(action || actions) && (
            <div className="flex items-center gap-2">
              {actions}
              {action}
            </div>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

interface EmptyStateProps {
  message: string;
  /** Ícone/ilustração opcional acima da mensagem (ex: um SVG ou emoji discreto). */
  icon?: ReactNode;
  /** Ação opcional (ex: "Cadastrar o primeiro paciente"). */
  action?: ReactNode;
}

export function EmptyState({ message, icon, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      {icon && <div className="text-ink-faint">{icon}</div>}
      <p className="text-sm text-ink-faint">{message}</p>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

function SkeletonBar({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-sm bg-canvas-raised ${className ?? ""}`} />;
}

interface LoadingStateProps {
  /** Forma do esqueleto a imitar. `"text"` (padrão) é uma versão compacta
   * para espaços pequenos; `"table"` imita linhas de tabela; `"cards"`
   * imita uma grade de KpiCards. */
  variant?: "text" | "table" | "cards";
  /** Número de linhas/itens do esqueleto (padrão varia por variant). */
  rows?: number;
}

export function LoadingState({ variant = "text", rows }: LoadingStateProps) {
  if (variant === "table") {
    const rowCount = rows ?? 5;
    return (
      <div role="status" aria-label="Carregando" className="p-4">
        <span className="sr-only">Carregando...</span>
        <div className="space-y-3">
          {Array.from({ length: rowCount }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <SkeletonBar className="h-3 w-1/4" />
              <SkeletonBar className="h-3 w-1/6" />
              <SkeletonBar className="h-3 flex-1" />
              <SkeletonBar className="h-3 w-1/6" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === "cards") {
    const cardCount = rows ?? 4;
    return (
      <div role="status" aria-label="Carregando" className="grid grid-cols-1 gap-4 p-1 sm:grid-cols-2 lg:grid-cols-4">
        <span className="sr-only">Carregando...</span>
        {Array.from({ length: cardCount }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border-hairline bg-canvas-surface/80 p-4 shadow-card backdrop-blur-sm">
            <SkeletonBar className="mb-3 h-2.5 w-2/3" />
            <SkeletonBar className="mb-2 h-6 w-1/2" />
            <SkeletonBar className="h-2.5 w-1/3" />
          </div>
        ))}
      </div>
    );
  }

  const lineCount = rows ?? 3;
  return (
    <div role="status" aria-label="Carregando" className="space-y-2 p-6">
      <span className="sr-only">Carregando...</span>
      {Array.from({ length: lineCount }).map((_, i) => (
        <SkeletonBar key={i} className={`h-3 ${i === lineCount - 1 ? "w-2/5" : "w-full"}`} />
      ))}
    </div>
  );
}

interface ErrorStateProps {
  message: string;
  /** Quando informado, exibe um botão "Tentar novamente". */
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div role="alert" className="m-4 flex items-start justify-between gap-4 rounded border border-denied/20 bg-denied-bg px-4 py-3">
      <div className="flex items-start gap-2.5">
        <span aria-hidden className="mt-0.5 text-denied/80">
          ⚠
        </span>
        <p className="text-xs leading-relaxed text-ink">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="shrink-0 rounded-sm border border-denied/30 px-2.5 py-1 text-2xs font-medium text-denied transition-colors hover:bg-denied/10"
        >
          Tentar novamente
        </button>
      )}
    </div>
  );
}
