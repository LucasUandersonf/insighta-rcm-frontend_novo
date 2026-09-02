import { initialsFrom } from "@/lib/useCurrentUserProfile";
import { cn } from "@/lib/cn";

/**
 * Avatar textual (iniciais sobre fundo em degradê de marca) — não uma
 * foto: o produto não tem upload de avatar, e um retrato genérico de
 * placeholder seria exatamente o tipo de "dado fingido" que o resto da
 * UI evita de propósito (ver comentário "Zero Mocks" em
 * DashboardPage.tsx). Serve tanto para a identificação de usuário na
 * TopBar quanto, futuramente, para qualquer lista que precise
 * referenciar uma pessoa (ex: autor de um log de auditoria).
 */
export function UserAvatar({ fullName, size = "md" }: { fullName: string; size?: "sm" | "md" }) {
  const dimensions = size === "sm" ? "h-6 w-6 text-2xs" : "h-8 w-8 text-xs";
  return (
    <span
      aria-hidden
      className={cn(
        // Degradê de marca (céu -> índigo -> violeta, ver DECISÃO v3 em
        // index.css) — nunca as cores semânticas de dado (revenue/pending/
        // denied), que ficam reservadas para comunicar estado de negócio.
        "flex shrink-0 items-center justify-center rounded-full bg-aura-line font-semibold tracking-tight text-white",
        dimensions
      )}
    >
      {initialsFrom(fullName)}
    </span>
  );
}
