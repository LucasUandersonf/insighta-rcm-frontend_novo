import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

export interface TourStep {
  /** Seletor CSS do item a destacar (ex: `[data-tour-id="/upload"]`) —
   * omitido = passo "centralizado", sem alvo (boas-vindas/despedida). */
  targetSelector?: string;
  title: string;
  description: string;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const HIGHLIGHT_PADDING = 6;
const CARD_WIDTH = 320;
const CARD_ESTIMATED_HEIGHT = 190;
const VIEWPORT_MARGIN = 16;

/** Mede o elemento do passo atual e mantém a medida atualizada (scroll,
 * resize, mudança de layout do próprio elemento) enquanto o passo está
 * ativo — sem isso o destaque "descolaria" do item real ao redimensionar
 * a janela ou rolar a barra lateral. */
function useTargetRect(selector: string | undefined, active: boolean): Rect | null {
  const [rect, setRect] = useState<Rect | null>(null);

  useLayoutEffect(() => {
    if (!selector || !active) {
      setRect(null);
      return;
    }
    const el = document.querySelector<HTMLElement>(selector);
    if (!el) {
      setRect(null);
      return;
    }
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });

    function measure() {
      const r = el!.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    }
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(el);
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [selector, active]);

  return rect;
}

/** Abaixo do alvo quando há espaço, acima quando não há — clampado nas
 * bordas laterais da janela. Sem alvo, o card é centralizado via className. */
function cardPosition(rect: Rect | null): { top: number; left: number } | null {
  if (!rect) return null;
  const spaceBelow = window.innerHeight - (rect.top + rect.height);
  const placeBelow = spaceBelow >= CARD_ESTIMATED_HEIGHT + VIEWPORT_MARGIN;
  const top = placeBelow
    ? rect.top + rect.height + VIEWPORT_MARGIN
    : Math.max(VIEWPORT_MARGIN, rect.top - CARD_ESTIMATED_HEIGHT - VIEWPORT_MARGIN);
  const left = Math.min(Math.max(rect.left, VIEWPORT_MARGIN), window.innerWidth - CARD_WIDTH - VIEWPORT_MARGIN);
  return { top, left };
}

/**
 * Tour de boas-vindas guiado — passo a passo pelos módulos principais,
 * cada um apontando para o item real da barra lateral (via
 * `data-tour-id`, ver Sidebar.tsx) em vez de screenshots ou uma
 * ilustração à parte, para nunca ficar desatualizado se a navegação
 * mudar. Sem overlay escuro cobrindo a tela inteira: só o item apontado
 * ganha um anel de destaque (o "buraco" de luz vem de um box-shadow
 * gigante no próprio anel, não de uma segunda camada) — o resto da tela
 * continua legível e clicável por trás, a intenção é orientar, não travar.
 */
export function OnboardingTour({ isOpen, steps, onFinish }: { isOpen: boolean; steps: TourStep[]; onFinish: () => void }) {
  const [index, setIndex] = useState(0);
  const prefersReducedMotion = useReducedMotion();
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) setIndex(0);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onFinish();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onFinish]);

  // Achado do Laudo de Vistoria Técnica (parecer UX/acessibilidade): sem
  // isto, um usuário de teclado/leitor de tela nunca tinha o foco movido
  // para o card do tour — precisaria adivinhar que ele apareceu e ir
  // caçá-lo na página. Foca o card (não um botão específico dele) a
  // cada passo, o suficiente para o leitor de tela anunciar título +
  // descrição via aria-labelledby/aria-describedby abaixo.
  useEffect(() => {
    if (isOpen) cardRef.current?.focus();
  }, [isOpen, index]);

  const step = steps[index];
  const rect = useTargetRect(step?.targetSelector, isOpen);

  if (!isOpen || !step) return null;

  const isFirst = index === 0;
  const isLast = index === steps.length - 1;
  const position = cardPosition(rect);
  const titleId = `onboarding-tour-title-${index}`;
  const descriptionId = `onboarding-tour-description-${index}`;

  const content = (
    <div className="pointer-events-none fixed inset-0 z-[70]">
      {rect && (
        <motion.div
          aria-hidden
          initial={false}
          animate={{
            top: rect.top - HIGHLIGHT_PADDING,
            left: rect.left - HIGHLIGHT_PADDING,
            width: rect.width + HIGHLIGHT_PADDING * 2,
            height: rect.height + HIGHLIGHT_PADDING * 2,
          }}
          transition={prefersReducedMotion ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 32 }}
          className="absolute rounded-md ring-2 ring-accent shadow-[0_0_0_4000px_rgba(15,20,18,0.38)]"
        />
      )}

      <AnimatePresence mode="wait">
        <motion.div
          ref={cardRef}
          key={index}
          role="dialog"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          // Sem aria-modal: de propósito NÃO-modal (ver DECISÃO na
          // documentação do componente) — travar o resto da página pra
          // leitor de tela mentiria sobre o comportamento real, que é
          // deixar tudo clicável por trás.
          tabIndex={-1}
          initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={prefersReducedMotion ? undefined : { opacity: 0, y: -4 }}
          transition={{ duration: 0.16 }}
          style={position ? { position: "fixed", top: position.top, left: position.left, width: CARD_WIDTH } : { width: CARD_WIDTH }}
          className={cn(
            "pointer-events-auto rounded-lg border border-border-default bg-canvas-raised p-4 shadow-elevated focus:outline-none",
            !position && "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          )}
        >
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-2xs font-medium uppercase tracking-wide text-ink-faint">
              Passo {index + 1} de {steps.length}
            </span>
            <button
              type="button"
              onClick={onFinish}
              aria-label="Pular tour"
              title="Pular tour"
              className="rounded-sm p-0.5 text-ink-faint transition-colors hover:text-ink"
            >
              <X aria-hidden size={14} />
            </button>
          </div>
          <h2 id={titleId} className="mb-1 text-sm font-semibold text-ink">
            {step.title}
          </h2>
          <p id={descriptionId} className="mb-4 text-xs leading-relaxed text-ink-muted">
            {step.description}
          </p>
          <div className="flex items-center justify-between gap-2">
            <button type="button" onClick={onFinish} className="text-2xs font-medium text-ink-faint transition-colors hover:text-ink">
              Pular tour
            </button>
            <div className="flex gap-2">
              {!isFirst && (
                <Button variant="ghost" size="sm" onClick={() => setIndex((i) => i - 1)}>
                  Voltar
                </Button>
              )}
              <Button size="sm" onClick={() => (isLast ? onFinish() : setIndex((i) => i + 1))}>
                {isLast ? "Concluir" : "Próximo"}
              </Button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );

  return createPortal(content, document.body);
}
