import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { cn } from "@/lib/cn";

type SystemStatus = "checking" | "operational" | "degraded";

export function TopBar() {
  const { user, logout } = useAuth();
  const [status, setStatus] = useState<SystemStatus>("checking");

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
    <header className="flex h-14 items-center justify-between border-b border-border-hairline bg-canvas-surface/70 px-6 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <span className="font-serif text-sm font-semibold tracking-premium text-ink">Insighta RCM</span>
        <span className="text-border-default">/</span>
        <span className="text-sm text-ink-muted">Auditoria de Faturamento</span>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-2xs text-ink-muted">
          <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", statusConfig[status].dot)} />
          {statusConfig[status].label}
        </div>

        <div className="h-4 w-px bg-border-subtle" aria-hidden />

        <ThemeToggle />

        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-full border border-border-subtle bg-canvas-raised px-2 py-1 text-ink-muted">{user?.role}</span>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 rounded-sm border border-border-subtle px-2 py-1 text-ink-muted transition-colors hover:border-accent/40 hover:text-ink"
          >
            <LogOut aria-hidden size={12} />
            Sair
          </button>
        </div>
      </div>
    </header>
  );
}
