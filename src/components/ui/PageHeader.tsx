import type { ReactNode } from "react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

/** Cabeçalho padrão de página — título serifado + subtítulo + slot de
 * ação à direita (botão primário, seletor de período etc.). Entrada
 * com leve fade-up (Framer Motion), consistente em toda a aplicação —
 * antes cada página definia seu próprio `<h1>` com estilos levemente
 * diferentes; agora todas puxam daqui.
 *
 * DECISÃO — `greeting` é EXCLUSIVO da Sala de Comando (ver canvas de
 * design, Main.dc.html): no lugar do ícone em caixa que todas as
 * outras 17 telas usam, a Sala de Comando abre com uma saudação
 * pessoal ("Bom dia, Marina.") acima do título — é a única tela do
 * produto pensada como "abertura de sessão de trabalho", não como
 * "mais uma seção do sistema". Passar `greeting` desliga o ícone
 * automaticamente, mesmo que `icon` também seja passado — as duas
 * variantes nunca coexistem no canvas. */
export function PageHeader({
  title,
  subtitle,
  greeting,
  action,
  className,
}: {
  title: string;
  subtitle?: string;
  /** Mantido por compatibilidade — o cabeçalho do Redesign 2026 não desenha ícone (ver canvas de design). */
  icon?: LucideIcon;
  /** Saudação pessoal acima do título — ver DECISÃO acima. Só a Sala
   * de Comando usa isso; todas as outras telas usam `icon`. */
  greeting?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={cn("flex flex-wrap items-end justify-between gap-4", className)}
    >
      <div className="flex items-start gap-3">
        <div>
          {greeting && <p className="mb-1.5 text-sm text-ink-muted">{greeting}</p>}
          <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-[34px]">{title}</h1>
          {subtitle && <p className="mt-1.5 max-w-2xl text-sm text-ink-muted">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </motion.div>
  );
}
