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
        "flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-revenue font-semibold tracking-tight text-canvas-surface",
        dimensions
      )}
    >
      {initialsFrom(fullName)}
    </span>
  );
}
