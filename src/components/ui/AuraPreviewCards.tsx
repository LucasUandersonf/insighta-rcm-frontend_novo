import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Composição decorativa do painel de marca das telas públicas
 * (login/cadastro/recuperação de senha): três cartões de vidro sobrepostos
 * mostrando o que o Insighta faz — uma pergunta respondida com números, o
 * insight do dia e uma tendência. Leve balanço vertical por cima do repouso.
 *
 * Números ILUSTRATIVOS de propósito — diferente das telas do produto
 * (que seguem "zero mocks" à risca, ver DashboardPage.tsx), esta é arte
 * de marca numa tela pública, sem sessão nem tenant para ter dado real.
 */
const CARDS = [
  {
    key: "pergunta",
    rotate: -5,
    className: "left-0 top-[112px] w-[244px]",
    body: (
      <>
        <p className="flex items-center gap-1.5 text-2xs font-medium uppercase tracking-wide text-ink-faint">
          <Sparkles aria-hidden size={11} className="text-accent" />
          Pergunte ao Insighta
        </p>
        <p className="mt-2 text-xs text-ink-muted">“Qual convênio mais glosa?”</p>
        <p className="mt-1.5 whitespace-nowrap text-sm font-semibold text-ink">
          Amil <span className="font-normal text-ink-muted">— 5% das cobranças</span>
        </p>
      </>
    ),
  },
  {
    key: "insight",
    rotate: 6,
    className: "right-0 top-0 w-[176px]",
    body: (
      <>
        <p className="text-2xs font-medium uppercase tracking-wide text-ink-faint">Insight de hoje</p>
        <p className="tabular mt-1.5 text-lg font-semibold tracking-tightest text-pending">+18%</p>
        <p className="mt-0.5 text-2xs leading-snug text-ink-muted">faltas às segundas de manhã</p>
      </>
    ),
  },
  {
    key: "tendencia",
    rotate: -2,
    className: "right-2 top-[232px] w-[150px]",
    body: (
      <>
        <p className="text-2xs font-medium uppercase tracking-wide text-ink-faint">Receita do mês</p>
        <p className="tabular mt-1.5 text-lg font-semibold tracking-tightest text-revenue">+6,2%</p>
      </>
    ),
  },
] as const;

export function AuraPreviewCards({ className }: { className?: string }) {
  return (
    <div className={cn("relative h-[320px] w-[290px]", className)} aria-hidden>
      {CARDS.map((card, i) => (
        <motion.div
          key={card.key}
          className={cn(
            "absolute rounded-[16px] border border-border-hairline bg-glass p-3.5 shadow-elevated-lg backdrop-blur-xl",
            card.className
          )}
          style={{ zIndex: CARDS.length - i }}
          initial={{ opacity: 0, rotate: card.rotate }}
          animate={{ opacity: 1, y: [0, -6, 0], rotate: card.rotate }}
          transition={{
            opacity: { duration: 0.5, delay: 0.2 + i * 0.12, ease: "easeOut" },
            y: { duration: 5 + i, repeat: Infinity, ease: "easeInOut", delay: i * 0.4 },
          }}
        >
          {card.body}
        </motion.div>
      ))}
    </div>
  );
}
