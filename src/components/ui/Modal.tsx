import { useEffect, useRef, type ReactNode } from "react";

interface ModalProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  /** "lg" (padrão, max-w-lg) para formulários simples; "xl" para telas
   * mais densas (ex: Conferência de itens extraídos por IA, que precisa
   * de espaço pra uma tabela). */
  size?: "lg" | "xl";
}

const sizeClasses: Record<NonNullable<ModalProps["size"]>, string> = {
  lg: "max-w-lg",
  xl: "max-w-3xl",
};

const FOCUSABLE_SELECTOR = '[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])';

export function Modal({ title, isOpen, onClose, children, size = "lg" }: ModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4" role="dialog" aria-modal="true">
      <div
        ref={containerRef}
        tabIndex={-1}
        className={`w-full ${sizeClasses[size]} rounded border border-border-subtle bg-canvas-surface shadow-xl`}
      >
        <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
          <h2 className="text-sm font-medium text-ink">{title}</h2>
          <button onClick={onClose} aria-label="Fechar" className="text-ink-faint hover:text-ink">
            ✕
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}
