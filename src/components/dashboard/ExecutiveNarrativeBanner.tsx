import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { RecentlyResolvedList } from "@/components/dashboard/RecentlyResolvedList";
import { apiClient } from "@/lib/api-client";
import type { ExecutiveNarrative } from "@/lib/types";

/**
 * Resumo executivo narrado por IA — "o Jarvis pegando os cálculos e
 * transformando em texto explicativo... o gestor teria a impressão de
 * um sistema vivo" (pedido direto do usuário). Abre a Sala de Comando,
 * acima das abas — é o mesmo espírito da saudação por horário do dia
 * (PageHeader), só que substantivo: sintetiza os KPIs/insights reais do
 * período em 2-4 frases, escritas por IA em cima de números já
 * calculados (ver DECISÃO completa em
 * app/services/executive_narrative_service.py, backend — nunca inventa
 * nenhum número, só narra o que já foi calculado).
 *
 * DECISÃO — silencioso quando não há narrativa NEM situação resolvida,
 * nunca um card de erro
 * -------------------------------------------------------------------
 * `narrative: null` cobre tanto "IA não configurada" quanto "geração
 * falhou hoje" (o backend já decide isso, ver DECISÃO lá) — dos dois
 * lados, o tratamento aqui é o MESMO: não renderiza o texto narrado.
 * Esta é uma peça de abertura substantiva, mas não crítica — um erro de
 * rede aqui nunca deveria virar um alerta vermelho na primeira coisa que
 * o gestor vê ao abrir a tela.
 *
 * `recently_resolved` (memória contínua, Fase 3) aparece INDEPENDENTE de
 * `narrative` existir (Avaliação Home/Sala de Comando, Achado 3) — é um
 * dado determinístico do backend, não depende da IA decidir mencionar a
 * correção dentro do texto gerado.
 */
export function ExecutiveNarrativeBanner() {
  const { data } = useQuery({
    queryKey: ["analytics", "executive-narrative"],
    queryFn: () => apiClient.get<ExecutiveNarrative>("/api/v1/analytics/executive-narrative"),
    retry: false,
  });

  const recentlyResolved = data?.recently_resolved ?? [];
  if (!data?.narrative && recentlyResolved.length === 0) return null;

  return (
    <div className="space-y-2">
      {data?.narrative && (
        <div className="flex items-start gap-3 rounded-lg border border-aura-line/30 bg-gradient-to-br from-aura-line/[0.07] to-transparent px-4 py-3.5">
          <Sparkles size={16} strokeWidth={2} className="mt-0.5 shrink-0 text-aura-line" aria-hidden />
          <p className="text-sm leading-relaxed text-ink">{data.narrative}</p>
        </div>
      )}
      <RecentlyResolvedList titles={recentlyResolved} />
    </div>
  );
}
