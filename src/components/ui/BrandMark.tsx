import { cn } from "@/lib/cn";

/** Logo oficial do Insighta (símbolo "i" em degradê + palavra). Duas versões
 * do mesmo desenho: palavra em degradê no tema claro e em branco no escuro —
 * a ponta azul do degradê perde contraste sobre o fundo escuro do app. O
 * símbolo mantém o degradê original nos dois. Arquivos em public/brand/. */
const HEIGHT = { sm: "h-[38px]", md: "h-11", lg: "h-14" } as const;

export function BrandMark({ size = "md", className }: { size?: "sm" | "md" | "lg"; className?: string }) {
  const height = HEIGHT[size];
  return (
    <span className={cn("inline-flex shrink-0 items-center", className)}>
      <img src="/brand/insighta-logo.png" alt="Insighta" className={cn(height, "w-auto dark:hidden")} />
      <img src="/brand/insighta-logo-dark.png" alt="Insighta" className={cn(height, "hidden w-auto dark:block")} />
    </span>
  );
}
