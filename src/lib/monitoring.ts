// Monitoramento de erros em produção (Sentry) — 100% opcional.
// -----------------------------------------------------------------
// Mesmo padrão de "config opcional via VITE_*" usado em api-client.ts
// para VITE_API_BASE_URL: se a variável não estiver definida, o app
// funciona normalmente e nada é importado/carregado (sem custo de
// bundle, sem ruído no console). Se estiver definida, importamos
// @sentry/react dinamicamente (import() em vez de import estático no
// topo do arquivo) para não inflar o bundle de quem não usa Sentry.
//
// Postura de privacidade — dado de saúde, nunca por padrão para
// terceiros: sendDefaultPii: false (mesma decisão já tomada no
// backend). Isso NÃO redige automaticamente o corpo de exceptions que
// você mesmo capturar com contexto extra — só desliga o que o SDK
// coletaria por padrão (IP, cookies, etc).
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;

let sentryModule: typeof import("@sentry/react") | null = null;
let initialized = false;

export async function initMonitoring(): Promise<void> {
  if (!SENTRY_DSN) return; // sem DSN configurado: nenhuma tentativa de import, nenhum ruído.
  if (initialized) return;

  try {
    const Sentry = await import("@sentry/react");
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: import.meta.env.MODE,
      sendDefaultPii: false,
    });
    sentryModule = Sentry;
    initialized = true;
  } catch {
    // Falha ao carregar/inicializar o SDK de monitoramento não pode
    // derrubar a aplicação — o app funciona normalmente sem ele.
    sentryModule = null;
    initialized = false;
  }
}

/**
 * Reporta um erro ao Sentry quando o monitoramento está configurado e
 * inicializado; no-op silencioso caso contrário (sem DSN, ou
 * initMonitoring ainda não resolveu / falhou). Usado pelo
 * ErrorBoundary (erros de render) e pelo api-client (respostas 5xx
 * reais do backend — 4xx é validação normal do usuário e não deve
 * inundar o Sentry com eventos não-acionáveis).
 */
export function reportError(error: unknown, context?: Record<string, unknown>): void {
  if (!sentryModule) return;
  sentryModule.captureException(error, context ? { extra: context } : undefined);
}
