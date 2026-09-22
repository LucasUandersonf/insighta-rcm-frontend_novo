import { AbcCurvePanel } from "@/components/dashboard/AbcCurvePanel";
import { ConsumptionByProfessionalPanel } from "@/components/dashboard/ConsumptionByProfessionalPanel";
import { ContributionMarginPanel } from "@/components/dashboard/ContributionMarginPanel";

/**
 * Aba Estoque dedicada (Sala de Comando 3.0, achado do Comitê de
 * Liderança Tecnológica "5 pernas") — os 3 insights de BI mais
 * profundos prometidos no dicionário de dados de Estoque que ainda não
 * tinham tela própria: curva ABC de farmácia, desvio de consumo por
 * médico e margem de contribuição real por procedimento. Ruptura/
 * vencimento (os 2 primeiros insights de Estoque) já vivem no feed da
 * aba Diagnóstico — aqui é onde a análise fica mais profunda que um
 * card de alerta permite.
 */
export function EstoquePanel({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  return (
    <div className="space-y-4">
      <AbcCurvePanel dateFrom={dateFrom} dateTo={dateTo} />
      <ContributionMarginPanel dateFrom={dateFrom} dateTo={dateTo} />
      <ConsumptionByProfessionalPanel dateFrom={dateFrom} dateTo={dateTo} />
    </div>
  );
}
