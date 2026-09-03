import { Component, type ErrorInfo, type ReactNode } from "react";
import { reportError } from "@/lib/monitoring";

interface ErrorBoundaryProps {
  children: ReactNode;
  /**
   * "app" (padrão) — falha catastrófica antes até da navegação existir
   * (ex: AuthProvider/Router quebrando). Tela cheia, único remédio é
   * recarregar.
   *
   * "route" (achado F-05, Auditoria Go-Live) — usado dentro do
   * AppShell, envolvendo só o <Outlet/> (ver AppShell.tsx). Antes, só
   * existia o boundary "app": um erro de render em QUALQUER tela
   * individual (ex: um gráfico que recebe um formato de dado
   * inesperado) apagava a aplicação inteira — inclusive TopBar e
   * Sidebar, cortando o único jeito de o usuário navegar para uma tela
   * que funciona. Este modo mostra um erro contido, com TopBar/Sidebar
   * ainda de pé, para a pessoa poder ir para outra tela sem precisar
   * recarregar a página inteira.
   */
  scope?: "app" | "route";
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Error boundary de última linha — sem ela, um erro de render em
 * qualquer tela vira uma página em branco, sem nenhuma pista (mesmo
 * princípio da ConfigurationErrorScreen em App.tsx, mas para falhas em
 * tempo de execução em vez de config ausente em tempo de build).
 * Boundary precisa ser classe — React não tem equivalente em hook para
 * getDerivedStateFromError/componentDidCatch.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Reporta ao Sentry quando configurado; no-op silencioso caso
    // contrário (ver src/lib/monitoring.ts).
    reportError(error, { componentStack: info.componentStack });
  }

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.scope === "route") {
        return (
          <div className="rounded-xl border border-denied/25 bg-denied-bg p-6 text-center shadow-elevated backdrop-blur-xl">
            <h2 className="mb-2 text-sm font-semibold text-denied">Esta tela encontrou um erro</h2>
            <p className="text-sm text-ink-muted">
              O restante do sistema continua funcionando normalmente — use o menu ao lado para ir para outra tela.
            </p>
            <p className="mt-3 text-xs text-ink-faint">
              Isso já foi registrado. Se o problema persistir nesta tela específica, entre em contato com o suporte.
            </p>
            <button
              onClick={this.handleReload}
              className="mt-4 rounded-md border border-border-subtle bg-canvas-raised/60 px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-canvas-surface"
            >
              Recarregar página
            </button>
          </div>
        );
      }

      return (
        <div className="flex min-h-screen items-center justify-center px-4">
          <div className="max-w-md rounded-xl border border-denied/25 bg-denied-bg p-6 text-center shadow-elevated backdrop-blur-xl">
            <h1 className="mb-2 text-sm font-semibold text-denied">Algo deu errado</h1>
            <p className="text-sm text-ink-muted">
              A aplicação encontrou um erro inesperado e não conseguiu continuar exibindo esta tela.
            </p>
            <p className="mt-3 text-xs text-ink-faint">
              Isso já foi registrado. Recarregar a página costuma resolver — se o problema persistir, entre em
              contato com o suporte.
            </p>
            <button
              onClick={this.handleReload}
              className="mt-4 rounded-md bg-aura-line px-3 py-2 text-sm font-medium text-white shadow-elevated transition-all duration-150 hover:brightness-110 active:scale-[0.98]"
            >
              Recarregar página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
