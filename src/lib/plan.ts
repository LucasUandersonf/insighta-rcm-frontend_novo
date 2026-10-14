import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { PlanUsage } from "@/lib/types";

/**
 * Planos Basic, Pro e Redes (app/services/plans.py no backend). As chaves
 * abaixo são as mesmas que o backend devolve em `features`. O app usa o
 * plano para mostrar o cadeado ANTES de chamar uma rota do Pro; quem barra
 * de verdade é o backend (403 com error_code "plano_pro").
 */
export const FEATURES = {
  allInsights: "all_insights",
  denialMl: "denial_ml",
  contractPdfAi: "contract_pdf_ai",
  appealDraftAi: "appeal_draft_ai",
  noShowRisk: "no_show_risk",
  patientsAdvanced: "patients_advanced",
  marginInventory: "margin_inventory",
  askAi: "ask_ai",
  morningNewsAi: "morning_news_ai",
  whatsappReports: "whatsapp_reports",
  apiAccess: "api_access",
  benchmark: "benchmark",
} as const;

export type PlanFeature = (typeof FEATURES)[keyof typeof FEATURES];

export const FEATURE_PITCH: Record<PlanFeature, { title: string; text: string }> = {
  all_insights: { title: "Todas as 47 análises", text: "Previsões, pacientes, estoque, OPME e prontuário, além das 20 essenciais do Basic." },
  denial_ml: { title: "Modelo preditivo de glosa", text: "Aprende com o histórico de glosas da sua clínica e aponta o risco de cada guia." },
  contract_pdf_ai: { title: "Leitura de contrato por IA", text: "Envie o PDF do convênio e receba a tabela de preços pronta para conferir." },
  appeal_draft_ai: { title: "Minuta de recurso por IA", text: "O texto do recurso de glosa sai pronto, com o prazo calculado." },
  no_show_risk: { title: "Risco de falta por paciente", text: "Quem confirmar hoje, alerta a cada 2 horas e lista de espera para encaixar." },
  patients_advanced: { title: "Pacientes e marketing", text: "Pacientes de alto valor que sumiram, satisfação, valor de cada paciente e retorno de cada canal." },
  margin_inventory: { title: "Margem, custos e estoque", text: "O que dá lucro por procedimento, profissional e convênio, e o estoque sem ruptura nem vencimento." },
  ask_ai: { title: "Pergunte à IA", text: "Perguntas livres em português, respondidas com os números da clínica." },
  morning_news_ai: { title: "Jornal da manhã", text: "A IA escreve a manchete do dia antes de você chegar." },
  whatsapp_reports: { title: "Relatório no WhatsApp", text: "O PDF de segunda e o Extrato do dia 1 no WhatsApp de cada sócio." },
  api_access: { title: "Integração por API", text: "A equipe do seu ERP envia os dados sozinha, com chave de API e webhooks." },
  benchmark: { title: "Comparativo entre clínicas", text: "Sua glosa e seus preços de contrato contra a média de clínicas parecidas." },
};

export const PLAN_QUERY_KEY = ["subscription", "usage"] as const;

export function usePlan() {
  // Só é usado dentro das telas logadas (BillingGate, painéis, menu).
  const query = useQuery({
    queryKey: PLAN_QUERY_KEY,
    queryFn: () => apiClient.get<PlanUsage>("/api/v1/subscription/usage"),
    staleTime: 60_000,
    retry: false,
  });
  const usage = query.data;
  return {
    usage,
    isLoading: query.isLoading,
    plan: usage?.plan,
    /** Sem resposta ainda (ou erro), não bloqueia: o backend decide. */
    has: (feature: PlanFeature) => !Array.isArray(usage?.features) || usage.features.includes(feature),
  };
}

export function daysUntil(iso: string | null | undefined, now: Date = new Date()): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}
