/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  /** Opcional — DSN do Sentry. Quando ausente, monitoramento de erros fica desligado (ver src/lib/monitoring.ts). */
  readonly VITE_SENTRY_DSN?: string;
  /** Opcional — "homologacao" liga a faixa de ambiente de testes (ver EnvironmentBanner.tsx e AMBIENTES.md). */
  readonly VITE_APP_ENV?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
