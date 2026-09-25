/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  /** Opcional — DSN do Sentry. Quando ausente, monitoramento de erros fica desligado (ver src/lib/monitoring.ts). */
  readonly VITE_SENTRY_DSN?: string;
  /** Opcional — "homologacao" liga a faixa de ambiente de testes (ver EnvironmentBanner.tsx e AMBIENTES.md). */
  readonly VITE_APP_ENV?: string;
  /** Opcional — WhatsApp do suporte, só dígitos com DDI (ex.: 5511999999999). Ver src/lib/support.ts. */
  readonly VITE_SUPPORT_WHATSAPP?: string;
  /** Opcional — e-mail do suporte exibido na Central de Ajuda e no login. */
  readonly VITE_SUPPORT_EMAIL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
