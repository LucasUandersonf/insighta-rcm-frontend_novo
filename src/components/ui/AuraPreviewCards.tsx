import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

/**
 * Composição decorativa para o painel de marca das telas públicas
 * (login/cadastro/recuperação de senha) — dois cartões de vidro
 * sobrepostos e levemente inclinados, exatamente como em Login.dc.html
 * (2 cards, sem ícone, tamanho/posição/rotação fixos). Só um leve
 * balanço vertical foi adicionado por cima do estado de repouso (o
 * canvas é uma foto estática, não proíbe um detalhe de movimento sutil).
 *
 * Números ILUSTRATIVOS de propósito — diferente das telas do produto
 * (que seguem "zero mocks" à risca, ver DashboardPage.tsx), esta é arte
 * de marca numa tela pública, sem sessão nem tenant nenhum ainda para
 * ter dado real para mostrar. Mesmo raciocínio das frases estáticas em
 * BRAND_HIGHLIGHTS (LoginPage.tsx).
 */
const PREVIEW_CARDS = [
  {
    label: "Caixa protegido",
    value: "R$ 61.900",
    tone: "text-revenue",
    rotate: -6,
    className: "left-2.5 top-[30px] h-[110px] w-[180px]",
  },
  {
    label: "Risco de glosa",
    value: "4,6%",
    tone: "text-pending",
    rotate: 7,
    className: "right-0 top-0 h-24 w-[150px]",
  },
] as const;

export function AuraPreviewCards({ className }: { className?: string }) {
  return (
    <div className={cn("relative h-[230px] w-[220px]", className)} aria-hidden>
      {PREVIEW_CARDS.map((card, i) => (
        <motion.div
          key={card.label}
          className={cn(
            "absolute rounded-[16px] border border-border-hairline bg-glass p-3.5 shadow-elevated-lg backdrop-blur-xl",
            card.className
          )}
          style={{ zIndex: PREVIEW_CARDS.length - i }}
          initial={{ opacity: 0, rotate: card.rotate }}
          animate={{ opacity: 1, y: [0, -6, 0], rotate: card.rotate }}
          transition={{
            opacity: { duration: 0.5, delay: 0.2 + i * 0.12, ease: "easeOut" },
            y: { duration: 5 + i, repeat: Infinity, ease: "easeInOut", delay: i * 0.4 },
          }}
        >
          <p className="text-2xs font-medium uppercase tracking-wide text-ink-faint">{card.label}</p>
          <p className={cn("tabular mt-1.5 text-lg font-semibold tracking-tightest", card.tone)}>{card.value}</p>
        </motion.div>
      ))}
    </div>
  );
}
