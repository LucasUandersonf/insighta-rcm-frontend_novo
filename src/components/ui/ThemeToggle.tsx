import { AnimatePresence, motion } from "framer-motion";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

/** Botão de troca de tema claro/escuro — ícone anima com rotação +
 * fade ao trocar (Framer Motion), tátil o suficiente pra confirmar a
 * ação sem ser um efeito gratuito. Ciclo simples (claro <-> escuro);
 * "system" continua disponível programaticamente via useTheme() para
 * quem quiser expor um seletor de 3 opções depois. */
export function ThemeToggle() {
  const { resolvedTheme, toggle } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Mudar para tema claro" : "Mudar para tema escuro"}
      title={isDark ? "Tema claro" : "Tema escuro"}
      className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-canvas-raised/60 text-ink-muted transition-colors hover:border-accent/40 hover:text-ink"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={isDark ? "moon" : "sun"}
          initial={{ opacity: 0, rotate: -90, scale: 0.6 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 90, scale: 0.6 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="flex items-center justify-center"
        >
          {isDark ? <Moon size={15} strokeWidth={2} /> : <Sun size={15} strokeWidth={2} />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
