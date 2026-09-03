import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { useRegisterModalOpen } from "@/context/ModalStackContext";

interface ModalProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  /** "lg" (padrão, max-w-lg ≈ 520px do canvas) para formulários simples;
   * "2xl" (820px, exato do canvas — ver ModalConferenciaIA.dc.html) para
   * a Conferência de itens extraídos por IA, que precisa de espaço pra
   * uma tabela. */
  size?: "lg" | "2xl";
}

const sizeClasses: Record<NonNullable<ModalProps["size"]>, string> = {
  lg: "max-w-lg",
  "2xl": "max-w-[820px]",
};

const FOCUSABLE_SELECTOR = '[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])';

export function Modal({ title, isOpen, onClose, children, size = "lg" }: ModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Registra este modal na contagem global (ver ModalStackContext) para
  // o AppShell saber quando desfocar/dessaturar o conteúdo por trás —
  // só possível porque este componente sai da árvore do AppShell via
  // portal (ver `createPortal` no final do arquivo): sem o portal, o
  // AppShell poderia simplesmente conferir os próprios filhos.
  useRegisterModalOpen(isOpen);

  // Ao abrir: guarda o elemento com foco (pra restaurar ao fechar) e move
  // o foco para dentro do modal (primeiro elemento focável, ou o próprio
  // container quando não há nenhum) — sem isso, o foco do teclado ficava
  // "perdido" atrás do overlay.
  useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;

    const container = containerRef.current;
    const focusable = container?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    if (focusable && focusable.length > 0) {
      focusable[0].focus();
    } else {
      container?.focus();
    }

    return () => {
      previouslyFocusedRef.current?.focus?.();
    };
  }, [isOpen]);

  // Escape fecha; Tab/Shift+Tab formam um focus trap básico — o foco
  // nunca escapa do modal enquanto ele está aberto.
  useEffect(() => {
    if (!isOpen) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      if (e.key !== "Tab") return;

      const container = containerRef.current;
      if (!container) return;

      const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => !el.hasAttribute("disabled")
      );
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (e.shiftKey) {
        if (active === first || !container.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last || !container.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  // Portal para document.body — precisa ficar FORA da árvore do
  // AppShell (que renderiza <Outlet/>, ancestral de qualquer página que
  // use este Modal) para o filtro de blur/dessaturação aplicado lá (ver
  // AppShell.tsx) não borrar o próprio modal junto com o conteúdo atrás
  // dele. Sem o portal, os dois seriam a mesma subárvore do DOM.
  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-40 flex items-center justify-center bg-canvas-deep/70 px-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            ref={containerRef}
            tabIndex={-1}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={cn("w-full rounded-lg border border-border-hairline bg-glass shadow-elevated-lg backdrop-blur-xl", sizeClasses[size])}
          >
            <div className="flex items-center justify-between border-b border-border-hairline px-5 py-3.5">
              <h2 className="font-serif text-sm font-medium tracking-premium text-ink">{title}</h2>
              <button
                onClick={onClose}
                aria-label="Fechar"
                className="flex h-7 w-7 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-canvas-raised hover:text-ink"
              >
                <X size={15} />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
