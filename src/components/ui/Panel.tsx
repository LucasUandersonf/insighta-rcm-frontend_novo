import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Circle, RotateCcw } from "lucide-react";
import { cn } from "@/lib/cn";
import { BentoCard } from "@/components/ui/BentoGrid";

/** Card de conteúdo padrão — mesma casca visual do BentoCard (borda
 * fio de cabelo + sombra rasa + leve levitação no hover), com um
 * header opcional de título/subtítulo/ações. `colSpan`/`rowSpan`
 * deixam o Panel participar diretamente de um <BentoGrid> quando a
 * página precisa de layout assimétrico — omitidos, o Panel se
 * comporta como um bloco de largura total (uso tradicional). */
export function Panel({
  title,
  subtitle,
  action,
  actions,
  colSpan,
  rowSpan,
  className,
  children,
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  /** Slot adicional no header, ao lado de `action` (ex: barra de filtros, ações em lote). */
  actions?: ReactNode;
  colSpan?: number;
  rowSpan?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <BentoCard colSpan={colSpan ?? 12} rowSpan={rowSpan} noPadding className={cn("w-full", className)}>
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
    </BentoCard>
  );
}

interface EmptyStateProps {
  message: string;
  /** Ícone/ilustração opcional acima da mensagem (ex: um ícone lucide). */
  icon?: ReactNode;
  /** Ação opcional (ex: "Cadastrar o primeiro paciente"). */
  action?: ReactNode;
}

export function EmptyState({ message, icon, action }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center gap-3.5 px-6 py-14 text-center"
    >
      <span
        aria-hidden
        className="flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-border-default bg-canvas-raised/60 text-ink-faint"
      >
        {icon ?? <Circle size={18} strokeWidth={1.5} />}
      </span>
      <p className="max-w-xs text-sm leading-relaxed text-ink-faint">{message}</p>
      {action && <div className="mt-1">{action}</div>}
    </motion.div>
  );
}

function SkeletonBar({ className }: { className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-sm bg-canvas-raised", className)}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-canvas-surface/60 to-transparent" />
    </div>
  );
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
          <div key={i} className="rounded-lg border border-border-hairline bg-canvas-surface p-4 shadow-card">
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
        <SkeletonBar key={i} className={cn("h-3 w-full", i === lineCount - 1 && "w-2/5")} />
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
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      role="alert"
      className="m-4 flex items-start justify-between gap-4 rounded-md border border-denied/20 bg-denied-bg px-4 py-3"
    >
      <div className="flex items-start gap-2.5">
        <AlertTriangle aria-hidden size={15} className="mt-0.5 shrink-0 text-denied/80" />
        <p className="text-xs leading-relaxed text-ink">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex shrink-0 items-center gap-1.5 rounded-sm border border-denied/30 px-2.5 py-1 text-2xs font-medium text-denied transition-colors hover:bg-denied/10"
        >
          <RotateCcw aria-hidden size={11} />
          Tentar novamente
        </button>
      )}
    </motion.div>
  );
}
