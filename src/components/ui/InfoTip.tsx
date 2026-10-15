import { useId, useState } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Suporte zero: o "i" ao lado de um número abre como ele é calculado e de
 * onde vem, sem sair da tela. Abre no clique (celular) e no foco/hover
 * (teclado e mouse); Esc fecha.
 */
export function InfoTip({ label, text, className }: { label: string; text: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className={cn("relative inline-flex", className)} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        aria-label={`Como calculamos: ${label}`}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen(true)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        className="rounded-full p-0.5 text-ink-faint hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        <Info aria-hidden size={13} />
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute left-1/2 top-full z-30 mt-1.5 w-64 -translate-x-1/2 rounded-md border border-border-hairline bg-canvas-raised p-2.5 text-left text-xs font-normal leading-relaxed text-ink shadow-elevated"
        >
          <span className="mb-1 block font-medium">Como calculamos</span>
          {text}
        </span>
      )}
    </span>
  );
}
