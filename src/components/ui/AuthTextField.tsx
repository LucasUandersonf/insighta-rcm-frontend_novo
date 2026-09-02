import type { InputHTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

interface AuthTextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  icon: LucideIcon;
  error?: string;
}

/** Campo de texto com ícone à esquerda — usado só nas telas públicas
 * (login/cadastro/recuperação de senha). Foco em accent (marca), não em
 * revenue (reservado a comunicar dado financeiro) — diferente de
 * TextField (FormField.tsx), usado no resto do app autenticado. */
export function AuthTextField({ label, icon: Icon, error, id, className, ...props }: AuthTextFieldProps) {
  const fieldId = id ?? `auth-field-${label}`;
  return (
    <div className="mb-4">
      <label htmlFor={fieldId} className="mb-1.5 block text-xs font-medium text-ink-muted">
        {label}
      </label>
      <div className="relative">
        <Icon aria-hidden size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
        <input
          id={fieldId}
          className={cn(
            "w-full rounded-md border bg-canvas-raised/60 py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-faint transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15",
            error ? "border-denied/50" : "border-border-default",
            className
          )}
          {...props}
        />
      </div>
      {error && <p className="mt-1 text-2xs text-denied">{error}</p>}
    </div>
  );
}
