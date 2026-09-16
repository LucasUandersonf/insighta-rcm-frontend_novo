import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import type { DataFreshness } from "@/lib/types";

/**
 * Achado do Dossiê Insighta RCM ("Como o dado entra no sistema") —
 * nenhuma tela fora do histórico de upload mostrava "desde quando" os
 * números da Sala de Comando refletem a realidade. Diferente do selo
 * "atualizado há X min" de Panel.tsx (que mede quando o NAVEGADOR
 * buscou o dado da API pela última vez): este banner mede quando o
 * ARQUIVO mais recente foi importado do sistema da clínica — a pergunta
 * real do gestor é "esse número é de hoje ou de 3 semanas atrás porque
 * ninguém subiu arquivo novo?", não "a página está com cache velho?".
 *
 * Sem `data.items` (nenhuma ingestão bem-sucedida ainda) o banner nem
 * aparece — nada a avisar, e um "0 dias" ou traço vazio só teria
 * poluído a tela de quem ainda está no fluxo de cadastro manual.
 */

const DATA_TYPE_LABELS: Record<string, string> = {
  faturamento: "Faturamento",
  agenda: "Agenda",
  glosa: "Glosa",
};

// Piso a partir do qual o banner muda de "informativo" para "atenção"
// — faturamento/agenda tendem a ser importados em ciclo diário ou
// semanal; 3 dias sem nenhuma ingestão nova já é tempo suficiente para
// a Sala de Comando estar mostrando um retrato desatualizado.
const STALE_AFTER_MS = 3 * 24 * 60 * 60 * 1000;

function formatRelative(isoTimestamp: string, nowMs: number): string {
  const diffMs = Math.max(0, nowMs - new Date(isoTimestamp).getTime());
  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffMinutes < 60) return diffMinutes <= 1 ? "há 1 min" : `há ${diffMinutes} min`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return diffHours === 1 ? "há 1h" : `há ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  return diffDays === 1 ? "há 1 dia" : `há ${diffDays} dias`;
}

export function DataFreshnessBanner() {
  const { data } = useQuery({
    queryKey: ["analytics", "data-freshness"],
    queryFn: () => apiClient.get<DataFreshness>("/api/v1/analytics/data-freshness"),
  });

  // Recalcula o texto relativo periodicamente, mesmo sistema de
  // envelhecimento local de Panel.tsx::FreshnessBadge — o dado em si só
  // muda quando a query real refizer o fetch.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  if (!data || data.items.length === 0 || data.stalest_at === null) return null;

  const isStale = now - new Date(data.stalest_at).getTime() > STALE_AFTER_MS;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border px-3.5 py-2 text-2xs",
        isStale ? "border-pending/30 bg-pending-bg text-pending" : "border-border-hairline bg-canvas-raised text-ink-faint"
      )}
    >
      <span className="flex shrink-0 items-center gap-1.5 font-medium">
        <Clock aria-hidden size={12} />
        Dado mais antigo importado {formatRelative(data.stalest_at, now)}
      </span>
      {data.items.map((item) => (
        <span key={item.data_type} title={new Date(item.last_ingested_at).toLocaleString("pt-BR")}>
          {DATA_TYPE_LABELS[item.data_type] ?? item.data_type}: {formatRelative(item.last_ingested_at, now)}
        </span>
      ))}
    </div>
  );
}
