import { cn } from "@/lib/cn";

/** Marca do produto — glifo em degradê de marca (céu/índigo/violeta, ver
 * DECISÃO v3 em index.css) + nome. Usado nas telas públicas
 * (login/cadastro/recuperação de senha), onde não há TopBar para
 * carregar a identidade visual. */
export function BrandMark({ size = "md", className }: { size?: "sm" | "md" | "lg"; className?: string }) {
  const glyphSize = size === "lg" ? "h-11 w-11" : size === "sm" ? "h-8 w-8" : "h-9 w-9";
  const textSize = size === "lg" ? "text-xl" : size === "sm" ? "text-sm" : "text-lg";
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span aria-hidden className={cn("relative flex shrink-0 items-center justify-center rounded-xl bg-aura-line shadow-elevated", glyphSize)}>
        <span className="absolute inset-0 rounded-xl bg-aura-line blur-md opacity-60" />
        <svg viewBox="0 0 24 24" fill="none" className="relative h-[55%] w-[55%]" aria-hidden>
          <path
            d="M4 17V10.5M9.5 17V6M15 17V12.5M20 17V8"
            stroke="white"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className={cn("font-serif font-medium tracking-premium text-ink", textSize)}>Insighta RCM</span>
    </div>
  );
}
