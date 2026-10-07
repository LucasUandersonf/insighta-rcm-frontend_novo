import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import { ROLE_LABELS } from "@/lib/roles";
import type { UserRole } from "@/lib/types";

/** UX-25: tela sem permissão explica por quê e quem libera (antes, voltava
 * para a Home sem dizer nada). */
export function NoAccess({ role }: { role: UserRole }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
      <span aria-hidden className="flex h-11 w-11 items-center justify-center rounded-full bg-canvas-raised text-ink-muted">
        <Lock size={18} />
      </span>
      <h1 className="text-lg font-semibold text-ink">Esta tela não está disponível para o seu acesso</h1>
      <p className="text-sm leading-relaxed text-ink-muted">
        Seu papel na clínica é <strong className="text-ink">{ROLE_LABELS[role] ?? role}</strong>. Quem pode liberar o acesso é o(a)
        proprietário(a) ou um(a) administrador(a), em Usuários.
      </p>
      <Link to="/" className="text-sm font-medium text-accent-muted hover:underline">
        Voltar para o início
      </Link>
    </div>
  );
}
