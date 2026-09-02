import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { useCurrentUserProfile } from "@/lib/useCurrentUserProfile";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import type { Tenant } from "@/lib/types";

type SystemStatus = "checking" | "operational" | "degraded";

const ROLE_LABELS: Record<string, string> = {
  owner: "Proprietário(a)",
  admin: "Administrador(a)",
  financeiro: "Financeiro",
  atendimento: "Atendimento",
  auditor: "Auditor(a)",
};

export function TopBar() {
  const { user, logout } = useAuth();
  const [status, setStatus] = useState<SystemStatus>("checking");

  // Identificação do usuário (avatar + nome + clínica) — mesma queryKey
  // ["tenant"] já usada por TenantPage.tsx, então navegar até "Minha
  // Clínica" não dispara uma segunda chamada: o cache é compartilhado.
  const { data: profile } = useCurrentUserProfile();
  const { data: tenant } = useQuery({
    queryKey: ["tenant"],
    queryFn: () => apiClient.get<Tenant>("/api/v1/tenant"),
  });

  useEffect(() => {
    const apiBase = import.meta.env.VITE_API_BASE_URL as string;
    fetch(`${apiBase}/health`)
      .then((r) => setStatus(r.ok ? "operational" : "degraded"))
      .catch(() => setStatus("degraded"));
  }, []);

  const statusConfig: Record<SystemStatus, { label: string; dot: string }> = {
    checking: { label: "Verificando...", dot: "bg-ink-faint" },
    operational: { label: "Sistema operacional", dot: "bg-revenue" },
    degraded: { label: "Sistema com instabilidade", dot: "bg-denied" },
  };

  return (
    <header className="flex h-14 items-center justify-between border-b border-border-hairline bg-glass px-6 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <span className="font-serif text-sm font-semibold tracking-premium text-ink">Insighta RCM</span>
        <span className="text-border-default">/</span>
        <span className="text-sm text-ink-muted">{tenant?.trade_name ?? "Auditoria de Faturamento"}</span>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-2xs text-ink-muted">
          <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", statusConfig[status].dot)} />
          {statusConfig[status].label}
        </div>

        <div className="h-4 w-px bg-border-subtle" aria-hidden />

        <ThemeToggle />

        <div className="h-4 w-px bg-border-subtle" aria-hidden />

        {/* Identificação do usuário — avatar (iniciais) + nome + papel,
            alimentado por GET /users/me (ver useCurrentUserProfile).
            Enquanto o perfil carrega, cai para o papel já disponível no
            JWT (user?.role) em vez de mostrar um espaço vazio. */}
        <div className="flex items-center gap-2.5">
          <UserAvatar fullName={profile?.full_name ?? user?.role ?? "?"} />
          <div className="hidden leading-tight sm:block">
            <p className="text-xs font-medium text-ink">{profile?.full_name ?? "..."}</p>
            <p className="text-2xs text-ink-faint">{ROLE_LABELS[user?.role ?? ""] ?? user?.role}</p>
          </div>
          <button
            onClick={logout}
            title="Sair"
            aria-label="Sair"
            className="flex items-center gap-1.5 rounded-sm border border-border-subtle px-2 py-1 text-ink-muted transition-colors hover:border-accent/40 hover:text-ink"
          >
            <LogOut aria-hidden size={12} />
            <span className="sm:hidden">Sair</span>
          </button>
        </div>
      </div>
    </header>
  );
}
