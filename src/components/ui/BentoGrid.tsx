import { motion } from "framer-motion";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Sistema de layout Bento — grade de 12 colunas onde cada card declara
 * quanto espaço ocupa (`colSpan`) em vez do layout tradicional de
 * "uma coluna de KPIs, depois um painel largo, depois outro". Isso é o
 * que permite a assimetria intencional do brief (card de insight
 * grande ao lado de números de apoio pequenos, por exemplo) sem virar
 * bagunça — todo mundo continua alinhado à mesma grade de 8px/12col.
 */

const COL_SPAN_CLASSES: Record<number, string> = {
  1: "lg:col-span-1",
  2: "lg:col-span-2",
  3: "lg:col-span-3",
  4: "lg:col-span-4",
  5: "lg:col-span-5",
  6: "lg:col-span-6",
  7: "lg:col-span-7",
  8: "lg:col-span-8",
  9: "lg:col-span-9",
  10: "lg:col-span-10",
  11: "lg:col-span-11",
  12: "lg:col-span-12",
};

const ROW_SPAN_CLASSES: Record<number, string> = {
  1: "lg:row-span-1",
  2: "lg:row-span-2",
  3: "lg:row-span-3",
};

export function BentoGrid({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12 lg:auto-rows-[minmax(0,auto)]", className)} {...props}>
      {children}
    </div>
  );
}

interface BentoCardProps extends HTMLAttributes<HTMLDivElement> {
  /** Quantas das 12 colunas o card ocupa em telas grandes (padrão: 4). */
  colSpan?: number;
  /** Quantas linhas o card ocupa — só relevante quando outros cards ao
   * lado precisam "abraçar" um card mais alto (padrão: 1). */
  rowSpan?: number;
  /** Tonalidade da borda de destaque no hover/foco — deixa o card
   * "vivo" no toque sem depender de sombra pesada. */
  glow?: "none" | "revenue" | "pending" | "denied" | "accent";
  /** Remove o padding interno padrão, para cards que controlam o
   * próprio espaçamento (ex: com header + corpo com fundo diferente). */
  noPadding?: boolean;
  children?: ReactNode;
}

const GLOW_HOVER_CLASSES: Record<NonNullable<BentoCardProps["glow"]>, string> = {
  none: "hover:border-border",
  revenue: "hover:border-revenue/40",
  pending: "hover:border-pending/40",
  denied: "hover:border-denied/40",
  accent: "hover:border-accent/40",
};

/** Célula base do bento grid — borda fio-de-cabelo, superfície sólida,
 * elevação sutil por sombra rasa (não drop-shadow pesado), leve
 * levitação no hover (Framer Motion) para dar resposta tátil imediata. */
export function BentoCard({
  colSpan = 4,
  rowSpan = 1,
  glow = "none",
  noPadding = false,
  className,
  children,
  ...props
}: BentoCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={cn(
        "group relative col-span-1 flex flex-col overflow-hidden rounded-lg border border-border-hairline bg-canvas-surface shadow-card transition-colors",
        COL_SPAN_CLASSES[colSpan],
        ROW_SPAN_CLASSES[rowSpan],
        GLOW_HOVER_CLASSES[glow],
        !noPadding && "p-5",
        className
      )}
      {...(props as any)}
    >
      {children}
    </motion.div>
  );
}
