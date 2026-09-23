import { Activity } from "lucide-react";
import { cn } from "@/lib/cn";

/** Marca do produto — mesmo glifo da TopBar (quadrado violeta de marca com
 * o traço de pulso, Redesign 2026) + nome. Usado nas telas públicas
 * (login/cadastro/recuperação de senha), onde não há TopBar para
 * carregar a identidade visual. */
export function BrandMark({ size = "md", className }: { size?: "sm" | "md" | "lg"; className?: string }) {
  const glyphSize = size === "lg" ? "h-11 w-11 rounded-xl" : size === "sm" ? "h-[30px] w-[30px] rounded-[9px]" : "h-9 w-9 rounded-[10px]";
  const iconSize = size === "lg" ? 22 : size === "sm" ? 16 : 18;
  const textSize = size === "lg" ? "text-xl" : size === "sm" ? "text-base" : "text-lg";
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span aria-hidden className={cn("flex shrink-0 items-center justify-center bg-brand", glyphSize)}>
        <Activity size={iconSize} strokeWidth={2.4} className="text-white" />
      </span>
      <span className={cn("font-semibold tracking-[-0.01em] text-ink", textSize)}>Insighta RCM</span>
    </div>
  );
}
