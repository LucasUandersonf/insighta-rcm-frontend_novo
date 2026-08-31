/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  /** Opcional — DSN do Sentry. Quando ausente, monitoramento de erros fica desligado (ver src/lib/monitoring.ts). */
  readonly VITE_SENTRY_DSN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
