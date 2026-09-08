import { Construction } from "lucide-react";
import { EmptyState } from "@/components/ui/Panel";

/**
 * Aba Oportunidades — Sala de Comando 2.0, Nível 1 do roadmap (radar de
 * contrato desatualizado + ranking de renegociação, ver Roadmap "Sala
 * de Comando 2.0"). Deliberadamente NÃO implementado nesta rodada: o
 * backend exigiria cruzar contrato de preço entre clínicas por
 * convênio+procedimento (Billing -> Appointment -> ContractItem ->
 * InsurancePlan.normalized_key, entre tenants) — mais complexo que o
 * Comparativo (que só agrega taxa, não preço por procedimento) e
 * merece uma rodada dedicada, não uma versão apressada.
 *
 * Este placeholder existe de propósito, em vez de simplesmente esconder
 * a aba: é honesto sobre o que falta, sem fingir que já está pronto.
 */
export function OportunidadesPanel() {
  return (
    <EmptyState
      icon={<Construction size={17} strokeWidth={1.5} />}
      message="Em construção — ranking de contratos abaixo da mediana da rede, ordenado por quanto vale renegociar. Faz parte do roadmap Sala de Comando 2.0."
    />
  );
}
