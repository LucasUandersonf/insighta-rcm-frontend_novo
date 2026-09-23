import { useEffect, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Circle, RotateCcw } from "lucide-react";
import { cn } from "@/lib/cn";
import { BentoCard, type BentoCardProps } from "@/components/ui/BentoGrid";

// Épico F4.3 do Plano Diretor ("Frescor de dado / SLA de atualização")
// — selo "atualizado há X min" no header de qualquer Panel que passe
// `updatedAt` (tipicamente `dataUpdatedAt` de um useQuery do React
// Query). Recalcula a cada 30s via um tick local, não uma nova
// requisição — é só o TEXTO relativo envelhecendo, o dado em si só
// muda quando a query real refizer o fetch.
function formatFreshness(updatedAtMs: number, nowMs: number): string {
  const diffSeconds = Math.max(0, Math.floor((nowMs - updatedAtMs) / 1000));
  if (diffSeconds < 45) return "atualizado agora";
  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) return `atualizado há ${diffMinutes} min`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `atualizado há ${diffHours}h`;
  const diffDays = Math.round(diffHours / 24);
  return `atualizado há ${diffDays}d`;
}

function FreshnessBadge({ updatedAt }: { updatedAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, []);
  return (
    <span
      className="shrink-0 whitespace-nowrap text-2xs text-ink-faint"
      title={new Date(updatedAt).toLocaleString("pt-BR")}
    >
      {formatFreshness(updatedAt, now)}
    </span>
  );
}

/** Card de conteúdo padrão — mesma casca visual do BentoCard (borda
 * fio de cabelo + sombra rasa + leve levitação no hover), com um
 * header opcional de título/subtítulo/ações. `colSpan`/`rowSpan`
 * deixam o Panel participar diretamente de um <BentoGrid> quando a
 * página precisa de layout assimétrico — omitidos, o Panel se
 * comporta como um bloco de largura total (uso tradicional).
 *
 * `glow` — mesmo mecanismo de "atenção" da Sala de Comando
 * (SmartInsightsFeed/HealthScoreWidget): borda de hover tingida pela
 * severidade real do conteúdo (fila de correção com item pendente,
 * recurso de glosa vencido, convênio não reconhecido...), nunca uma cor
 * decorativa. Omitido (ou "none") continua sendo o padrão de qualquer
 * Panel sem um estado de atenção genuíno para comunicar. */
export function Panel({
  title,
  subtitle,
  action,
  actions,
  updatedAt,
  colSpan,
  rowSpan,
  glow,
  className,
  children,
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  /** Slot adicional no header, ao lado de `action` (ex: barra de filtros, ações em lote). */
  actions?: ReactNode;
  /** Épico F4.3 do Plano Diretor ("Frescor de dado / SLA de
   * atualização") — timestamp (ms epoch) de quando os dados deste
   * painel foram buscados pela última vez, normalmente
   * `dataUpdatedAt` do useQuery correspondente. Omitido/0/null = sem
   * selo (painel ainda sem dado carregado, ou que ainda não adotou
   * isso). */
  updatedAt?: number | null;
  colSpan?: number;
  rowSpan?: number;
  glow?: BentoCardProps["glow"];
  className?: string;
  children: ReactNode;
}) {
  return (
    <BentoCard colSpan={colSpan ?? 12} rowSpan={rowSpan} glow={glow} noPadding className={cn("w-full", className)}>
      {(title || subtitle || action || actions || updatedAt) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-hairline px-6 py-5">
          <div>
            {title && <h2 className="text-base font-semibold text-ink">{title}</h2>}
            {subtitle && <p className="mt-1 text-[13px] text-ink-muted">{subtitle}</p>}
          </div>
          {(action || actions || updatedAt) && (
            <div className="flex items-center gap-3">
              {!!updatedAt && <FreshnessBadge updatedAt={updatedAt} />}
              {(action || actions) && (
                <div className="flex items-center gap-2">
                  {actions}
                  {action}
                </div>
              )}
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
      className="flex flex-col items-center gap-3.5 px-6 py-[52px] text-center"
    >
      <span
        aria-hidden
        className="flex h-11 w-11 items-center justify-center rounded-full border border-dashed border-border-default bg-canvas-raised/60 text-ink-faint"
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
      className="m-4 flex items-start justify-between gap-4 rounded-md border border-denied/25 bg-denied-bg px-4 py-3"
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
