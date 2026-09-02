import { motion } from "framer-motion";
import { Gauge, ShieldCheck, TrendingDown } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Composição decorativa para o painel de marca das telas públicas
 * (login/cadastro/recuperação de senha) — cards de vidro flutuando com
 * leve movimento, no mesmo espírito do carrossel de cartões do produto
 * de referência, só que mais leve (sem arraste/autoplay: aqui é só
 * ilustração de marca, não um componente interativo).
 *
 * Números ILUSTRATIVOS de propósito — diferente das telas do produto
 * (que seguem "zero mocks" à risca, ver DashboardPage.tsx), esta é arte
 * de marca numa tela pública, sem sessão nem tenant nenhum ainda para
 * ter dado real para mostrar. Mesmo raciocínio das frases estáticas em
 * BRAND_HIGHLIGHTS (LoginPage.tsx), só que em formato de card.
 */
const PREVIEW_CARDS = [
  { icon: ShieldCheck, label: "Caixa protegido este mês", value: "R$ 42.850", trend: "+12%", tone: "text-revenue" },
  { icon: Gauge, label: "Ocupação da agenda", value: "82%", trend: "+4 p.p.", tone: "text-accent" },
  { icon: TrendingDown, label: "Risco de glosa", value: "6%", trend: "-3 p.p.", tone: "text-revenue" },
] as const;

export function AuraPreviewCards({ className }: { className?: string }) {
  return (
    <div className={cn("relative h-64 w-full max-w-xs", className)} aria-hidden>
      {PREVIEW_CARDS.map((card, i) => {
        const Icon = card.icon;
        return (
          <motion.div
            key={card.label}
            className="absolute w-60 rounded-xl border border-border-hairline bg-glass p-4 shadow-elevated-lg backdrop-blur-xl"
            style={{ left: i * 22, top: i * 50, zIndex: PREVIEW_CARDS.length - i }}
            initial={{ opacity: 0, y: 20, rotate: -2 + i * 2 }}
            animate={{ opacity: 1, y: [0, -8, 0], rotate: -2 + i * 2 }}
            transition={{
              opacity: { duration: 0.5, delay: 0.2 + i * 0.12, ease: "easeOut" },
              y: { duration: 5 + i, repeat: Infinity, ease: "easeInOut", delay: i * 0.4 },
            }}
          >
            <div className="flex items-center gap-2">
              <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-canvas-raised/70", card.tone)}>
                <Icon aria-hidden size={13} strokeWidth={2.2} />
              </span>
              <span className="text-2xs font-medium uppercase tracking-wide text-ink-faint">{card.label}</span>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="font-sans text-lg font-semibold tracking-tightest text-ink">{card.value}</span>
              <span className={cn("text-2xs font-medium", card.tone)}>{card.trend}</span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
