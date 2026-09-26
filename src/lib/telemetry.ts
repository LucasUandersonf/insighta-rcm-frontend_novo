/**
 * Telemetria de navegação: cada troca de tela autenticada vira um registro
 * (rota normalizada, sem ids, sem parâmetros), enviado em lote para
 * POST /telemetry/page-views. Serve para medir uso real no painel interno
 * (quem só LÊ telas também conta como ativo). Nunca envia conteúdo de tela.
 */
import { API_BASE_URL, getStoredToken } from "@/lib/api-client";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SEGMENT_OK = /^[a-z0-9-]{1,40}$/;
const FLUSH_EVERY_MS = 30_000;
const MAX_BATCH = 50;

type View = { path: string; at: string };
let queue: View[] = [];
let timer: ReturnType<typeof setInterval> | null = null;
let lastPath = "";

/** /pacientes/3f2a…/ficha?x=1 → /pacientes/:id/ficha (mesma regra do backend). */
export function normalizePath(raw: string): string {
  const path = raw.split("?")[0].split("#")[0];
  const parts = path
    .split("/")
    .filter(Boolean)
    .map((seg) => (UUID_RE.test(seg) || /^\d+$/.test(seg) ? ":id" : SEGMENT_OK.test(seg.toLowerCase()) ? seg.toLowerCase() : ":x"));
  return `/${parts.join("/")}`.slice(0, 120);
}

export function flushPageViews(): void {
  const token = getStoredToken();
  if (!API_BASE_URL || !token || queue.length === 0) return;
  const batch = queue.slice(0, MAX_BATCH);
  queue = queue.slice(MAX_BATCH);
  // keepalive: o envio sobrevive ao fechamento da aba (visibilitychange).
  fetch(`${API_BASE_URL}/api/v1/telemetry/page-views`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ views: batch }),
    keepalive: true,
  }).catch(() => {
    /* telemetria nunca atrapalha o uso: falhou, descarta */
  });
}

function ensureTimer(): void {
  if (timer || typeof window === "undefined") return;
  timer = setInterval(flushPageViews, FLUSH_EVERY_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushPageViews();
  });
}

export function trackPageView(pathname: string): void {
  const path = normalizePath(pathname);
  if (path === lastPath) return; // mesma tela (ex.: troca de query string)
  lastPath = path;
  queue.push({ path, at: new Date().toISOString() });
  if (queue.length >= MAX_BATCH) flushPageViews();
  ensureTimer();
}

/** Só para testes. */
export function _resetTelemetry(): void {
  queue = [];
  lastPath = "";
  if (timer) clearInterval(timer);
  timer = null;
}
export function _pendingViews(): View[] {
  return queue;
}
