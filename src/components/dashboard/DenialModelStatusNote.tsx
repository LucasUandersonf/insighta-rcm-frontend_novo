import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import type { DenialModelStatus } from "@/lib/types";

/** Texto da faixa — separado para teste. */
export function denialModelNote(data: DenialModelStatus): string {
  if (data.status === "ativo") {
    return "Modelo de glosa ativo: além das regras do contrato, o risco usa o que a própria clínica já teve glosado.";
  }
  if (data.status === "pronto_para_treinar") {
    return `Modelo de glosa pronto para treinar: ${data.samples} cobranças com desfecho, ${data.denied} glosas. O treino roda na atualização noturna do worker.`;
  }
  const missing: string[] = [];
  if (data.denied < data.min_class_samples) missing.push(`${data.denied} de ${data.min_class_samples} glosas mínimas`);
  if (data.not_denied < data.min_class_samples) missing.push(`${data.not_denied} de ${data.min_class_samples} cobranças pagas mínimas`);
  const detail = missing.length ? ` (${missing.join(", ")})` : "";
  return `Modelo em aprendizado: ${Math.min(data.samples, data.min_samples)} de ${data.min_samples} cobranças${detail}. Até lá, o risco de glosa usa só as regras do contrato.`;
}

/**
 * Frente 1 (nota 9 real) — o gestor precisa saber se o "risco de glosa"
 * já tem o modelo estatístico da clínica por trás ou só as regras do
 * contrato. Nada de prometer um ML que ainda não existe.
 */
export function DenialModelStatusNote() {
  const { data } = useQuery({
    queryKey: ["analytics", "denial-model-status"],
    queryFn: () => apiClient.get<DenialModelStatus>("/api/v1/analytics/denial-model-status"),
    staleTime: 10 * 60 * 1000,
  });
  if (!data || typeof data.status !== "string") return null;
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-border-hairline bg-white/[0.03] px-3.5 py-3">
      <Sparkles aria-hidden size={14} className="mt-0.5 shrink-0 text-accent" />
      <p className="text-xs leading-relaxed text-ink-muted">{denialModelNote(data)}</p>
    </div>
  );
}
