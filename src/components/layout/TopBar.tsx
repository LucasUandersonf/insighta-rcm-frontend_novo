import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LifeBuoy, LogOut, Menu } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { useCurrentUserProfile } from "@/lib/useCurrentUserProfile";
import { useOnboardingTour } from "@/context/OnboardingTourContext";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import type { Tenant } from "@/lib/types";
import { NotificationBell } from "./NotificationBell";
import { HelpCenterModal } from "./HelpCenterModal";

type SystemStatus = "checking" | "operational" | "degraded";

const ROLE_LABELS: Record<string, string> = {
  owner: "Proprietário(a)",
  admin: "Administrador(a)",
  financeiro: "Financeiro",
  atendimento: "Atendimento",
  auditor: "Auditor(a)",
};

interface TopBarProps {
  /** Achado da Auditoria de Prontidão v1 — ver DECISÃO em Sidebar.tsx.
   * Undefined em telas xl+ (AppShell não precisa passar nada lá), então
   * o botão nem aparece — a classe `xl:hidden` abaixo já cuidaria disso
   * de qualquer forma, isto é só pra não montar um botão sem função. */
  onToggleMobileNav?: () => void;
}

export function TopBar({ onToggleMobileNav }: TopBarProps) {
  const { user, logout } = useAuth();
  const { startTour } = useOnboardingTour();
  const [status, setStatus] = useState<SystemStatus>("checking");
  const [isHelpOpen, setIsHelpOpen] = useState(false);

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
    <header className="flex h-14 items-center justify-between border-b border-border-hairline bg-glass px-3 backdrop-blur-xl sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        {onToggleMobileNav && (
          <button
            type="button"
            onClick={onToggleMobileNav}
            aria-label="Abrir menu"
            title="Abrir menu"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border-subtle text-ink-muted transition-colors hover:border-accent/40 hover:text-ink xl:hidden"
          >
            <Menu aria-hidden size={16} strokeWidth={2} />
          </button>
        )}
        <span className="shrink-0 font-serif text-sm font-semibold tracking-premium text-ink">Insighta RCM</span>
        {/* Breadcrumb do nome da clínica — some em telas estreitas
            (achado da Auditoria de Prontidão v1: sem isso, o cluster de
            ícones à direita era empurrado pra fora da viewport em
            celular). O hambúrguer + wordmark já identificam a tela. */}
        <span className="hidden text-border-default sm:inline">/</span>
        <span className="hidden truncate text-sm text-ink-muted sm:inline">{tenant?.trade_name ?? "Auditoria de Faturamento"}</span>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-4">
        <div className="hidden items-center gap-1.5 text-2xs text-ink-muted md:flex">
          <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", statusConfig[status].dot)} />
          {statusConfig[status].label}
        </div>

        <div className="hidden h-4 w-px bg-border-subtle md:block" aria-hidden />

        <button
          type="button"
          onClick={() => setIsHelpOpen(true)}
          aria-label="Central de Ajuda"
          title="Central de Ajuda"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-canvas-raised/60 text-ink-muted transition-colors hover:border-accent/40 hover:text-ink"
        >
          <LifeBuoy aria-hidden size={15} strokeWidth={2} />
        </button>

        <NotificationBell />

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

      <HelpCenterModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        onStartTour={() => {
          setIsHelpOpen(false);
          startTour();
        }}
      />
    </header>
  );
}
