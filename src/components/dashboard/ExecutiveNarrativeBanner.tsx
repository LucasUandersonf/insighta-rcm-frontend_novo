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
        <section
          aria-label="Resumo do período"
          className="flex flex-col gap-3.5 rounded-[20px] border border-border-hairline bg-glass px-6 py-6 backdrop-blur-xl sm:px-8 sm:py-7"
        >
          <span className="flex items-center gap-2 text-xs font-medium text-accent-muted">
            <Sparkles size={14} strokeWidth={2} aria-hidden />
            Briefing do Insighta
            {data.generated_at && (
              <> · atualizado às {new Date(data.generated_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</>
            )}
          </span>
          <p className="font-serif text-xl leading-[1.45] text-ink sm:text-[25px]">{data.narrative}</p>
        </section>
      )}
      <RecentlyResolvedList titles={recentlyResolved} />
    </div>
  );
}
