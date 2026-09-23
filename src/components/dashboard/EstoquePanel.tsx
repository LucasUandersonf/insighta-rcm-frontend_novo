import { AbcCurvePanel } from "@/components/dashboard/AbcCurvePanel";
import { ConsumptionByProfessionalPanel } from "@/components/dashboard/ConsumptionByProfessionalPanel";
import { ContributionMarginPanel } from "@/components/dashboard/ContributionMarginPanel";
import { UnbilledConsumptionPanel } from "@/components/dashboard/UnbilledConsumptionPanel";

/**
 * Aba Estoque dedicada (Sala de Comando 3.0, achado do Comitê de
 * Liderança Tecnológica "5 pernas") — os 3 insights de BI mais
 * profundos prometidos no dicionário de dados de Estoque que ainda não
 * tinham tela própria: curva ABC de farmácia, desvio de consumo por
 * médico e margem de contribuição real por procedimento — mais a lista de
 * material usado e não cobrado. Os alertas de estoque ficam no topo da
 * aba (feed filtrado); estas seções são o destino dos botões deles.
 */
export function EstoquePanel({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  return (
    <div className="space-y-4">
      {/* Destinos dos alertas de estoque (ver action_href no motor de insights). */}
      <section id="nao-cobrado" className="scroll-mt-24">
        <UnbilledConsumptionPanel dateFrom={dateFrom} dateTo={dateTo} />
      </section>
      <section id="consumo-profissional" className="scroll-mt-24">
        <ConsumptionByProfessionalPanel dateFrom={dateFrom} dateTo={dateTo} />
      </section>
      <AbcCurvePanel dateFrom={dateFrom} dateTo={dateTo} />
      <ContributionMarginPanel dateFrom={dateFrom} dateTo={dateTo} />
    </div>
  );
}
