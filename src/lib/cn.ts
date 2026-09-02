import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Combina classes condicionais (clsx) e resolve conflitos de utilitário
 * Tailwind (tailwind-merge) — padrão shadcn/ui. Usar em todo componente
 * que aceita `className` como prop, pra permitir override seguro pelo
 * consumidor sem duplicar classes conflitantes (ex: `p-4` vs `p-2`). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
