import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, UserPlus } from "lucide-react";
import { BentoCard, BentoGrid } from "@/components/ui/BentoGrid";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/Panel";
import { SelectField, TextField } from "@/components/ui/FormField";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { cn } from "@/lib/cn";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import type { CapitalDecisionBaseData } from "@/lib/types";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

// Conversão semana -> mês usada pra projetar receita mensal a partir de
// uma carga horária semanal — mesma constante que qualquer cálculo de
// "por mês" a partir de "por semana" (52 semanas / 12 meses).
const WEEKS_PER_MONTH = 52 / 12;

function ResultCard({
  netGain,
  detailLine,
  paybackMonths,
  noPaybackInputMessage,
  negativeMessage,
}: {
  netGain: number | null;
  detailLine: string;
  paybackMonths: number | null;
  noPaybackInputMessage: string;
  negativeMessage: string;
}) {
  return (
    <div className="rounded-lg border border-border-hairline bg-canvas-raised/40 p-5 text-center">
      <span className="text-2xs font-medium uppercase tracking-wide text-ink-faint">Ganho líquido mensal estimado</span>
      <div
        className={cn(
          "mt-2 font-sans text-3xl font-semibold tracking-tightest",
          (netGain ?? 0) >= 0 ? "text-revenue" : "text-denied"
        )}
      >
        <AnimatedNumber value={netGain ?? 0} format={formatCurrency} durationSeconds={0.5} />
      </div>
      <p className="mt-2 text-2xs text-ink-muted">{detailLine}</p>
      {netGain !== null && netGain <= 0 && <p className="mt-3 text-2xs text-denied">{negativeMessage}</p>}
      {paybackMonths !== null && (
        <p className="mt-3 text-xs font-medium text-ink">Payback em ~{Math.ceil(paybackMonths)} mês(es)</p>
      )}
      {netGain !== null && netGain > 0 && paybackMonths === null && (
        <p className="mt-3 text-2xs text-ink-faint">{noPaybackInputMessage}</p>
      )}
    </div>
  );
}

/**
 * Épico F3.4 do Plano Diretor ("Decisões de capital: contratar/
 * expandir — simulação de payback de contratação"). Mesmo espírito de
 * SimuladorPanel.tsx (F3.3): a simulação em si é toda CLIENT-SIDE,
 * nunca grava nada — só ancora nos números reais que vêm de
 * GET /analytics/capital-decision-base-data (receita/margem por hora
 * já observada nesta clínica, faturamento médio das outras unidades do
 * grupo). Nunca inventa um benchmark de mercado — ver DECISÃO completa
 * no schema do backend.
 *
 * Duas simulações independentes: "Contratar" (sempre disponível, cai
 * pra média de toda a clínica sem amostra suficiente por especialidade
 * — ver `used_fallback_clinic_wide`) e "Expandir" (só quando a clínica
 * pertence a um grupo multi-unidade, épico F3.2 — estado normal da
 * maioria das clínicas é NÃO pertencer, tratado como EmptyState, nunca
 * erro).
 */
export function CapitalDecisionPanel() {
  const [specialty, setSpecialty] = useState("");
  const { data, isLoading, error } = useQuery({
    queryKey: ["analytics", "capital-decision-base-data", specialty],
    queryFn: () =>
      apiClient.get<CapitalDecisionBaseData>(
        `/api/v1/analytics/capital-decision-base-data${specialty ? `?specialty=${encodeURIComponent(specialty)}` : ""}`
      ),
  });

  // Contratar
  const [monthlyCost, setMonthlyCost] = useState(8000);
  const [weeklyHours, setWeeklyHours] = useState(20);
  const [onboardingCost, setOnboardingCost] = useState(0);

  // Expandir
  const [expansionMonthlyCost, setExpansionMonthlyCost] = useState(15000);
  const [setupCost, setSetupCost] = useState(50000);

  if (isLoading) return <LoadingState variant="cards" rows={2} />;
  if (error) return <ErrorState message={getApiErrorMessage(error)} />;
  if (!data) return null;

  const hourlyBasis = data.avg_margin_per_hour ?? data.avg_revenue_per_hour;
  const hourlyBasisIsMargin = data.avg_margin_per_hour !== null;
  const monthlyProjectedRevenue = hourlyBasis !== null ? hourlyBasis * weeklyHours * WEEKS_PER_MONTH : null;
  const monthlyNetGain = monthlyProjectedRevenue !== null ? monthlyProjectedRevenue - monthlyCost : null;
  const hiringPaybackMonths =
    monthlyNetGain !== null && monthlyNetGain > 0 && onboardingCost > 0 ? onboardingCost / monthlyNetGain : null;

  const expansionNetGain =
    data.avg_monthly_revenue_per_unit !== null ? data.avg_monthly_revenue_per_unit - expansionMonthlyCost : null;
  const expansionPaybackMonths =
    expansionNetGain !== null && expansionNetGain > 0 && setupCost > 0 ? setupCost / expansionNetGain : null;

  return (
    <div className="space-y-4">
      <BentoGrid>
        <BentoCard colSpan={12}>
          <div className="mb-5 flex items-start gap-2.5">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
              <UserPlus size={15} strokeWidth={1.5} />
            </span>
            <div>
              <p className="text-sm font-medium text-ink">Payback de uma nova contratação</p>
              <p className="mt-0.5 text-2xs text-ink-muted">
                Ancorado na receita/hora {hourlyBasisIsMargin ? "líquida (margem, já descontando custo)" : "bruta"} já
                observada nesta clínica nos últimos {data.window_days} dias — nunca um benchmark de mercado inventado.
              </p>
            </div>
          </div>

          {data.available_specialties.length > 0 && (
            <SelectField
              label="Especialidade da nova contratação (opcional)"
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              className="max-w-xs"
            >
              <option value="">Toda a clínica (sem filtro)</option>
              {data.available_specialties.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </SelectField>
          )}

          {data.used_fallback_clinic_wide && (
            <p className="-mt-2 mb-4 text-2xs text-pending">
              Amostra insuficiente para "{data.specialty_requested}" (mínimo {data.min_sample} profissionais) — usando a
              média de toda a clínica.
            </p>
          )}

          {hourlyBasis === null ? (
            <EmptyState
              icon={<UserPlus size={17} strokeWidth={1.5} />}
              message={`Ainda não há amostra suficiente (mínimo ${data.min_sample} profissionais com receita/hora observável nos últimos ${data.window_days} dias) para simular.`}
            />
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div>
                <TextField
                  label="Custo mensal da contratação (salário + encargos)"
                  type="number"
                  min={0}
                  value={monthlyCost}
                  onChange={(e) => setMonthlyCost(Number(e.target.value) || 0)}
                />
                <TextField
                  label="Carga horária semanal planejada (h)"
                  type="number"
                  min={0}
                  value={weeklyHours}
                  onChange={(e) => setWeeklyHours(Number(e.target.value) || 0)}
                />
                <TextField
                  label="Custo único de contratação (recrutamento, treinamento — opcional)"
                  type="number"
                  min={0}
                  value={onboardingCost}
                  onChange={(e) => setOnboardingCost(Number(e.target.value) || 0)}
                />
                <p className="text-2xs text-ink-faint">
                  Base: {formatCurrency(hourlyBasis)}/h, média de {data.sample_size} profissional(is) com amostra.
                </p>
              </div>
              <ResultCard
                netGain={monthlyNetGain}
                detailLine={`Receita/margem mensal projetada: ${formatCurrency(monthlyProjectedRevenue ?? 0)}`}
                paybackMonths={hiringPaybackMonths}
                noPaybackInputMessage="Sem custo único informado — ganho já positivo desde o 1º mês."
                negativeMessage="Nesta base, a contratação NÃO se paga com esses parâmetros — ajuste a carga horária ou o custo mensal."
              />
            </div>
          )}
        </BentoCard>
      </BentoGrid>

      <BentoGrid>
        <BentoCard colSpan={12}>
          <div className="mb-5 flex items-start gap-2.5">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
              <Building2 size={15} strokeWidth={1.5} />
            </span>
            <div>
              <p className="text-sm font-medium text-ink">Payback de abrir uma nova unidade</p>
              <p className="mt-0.5 text-2xs text-ink-muted">
                Ancorado no faturamento médio das outras unidades do mesmo grupo (Consolidado multi-unidade).
              </p>
            </div>
          </div>

          {!data.belongs_to_organization ? (
            <EmptyState
              icon={<Building2 size={17} strokeWidth={1.5} />}
              message="Esta clínica não faz parte de um grupo multi-unidade — sem dado de outra unidade pra basear a simulação de expansão."
            />
          ) : data.avg_monthly_revenue_per_unit === null ? (
            <EmptyState message="O grupo ainda não tem nenhuma outra unidade com faturamento pra basear a simulação." />
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div>
                <TextField
                  label="Custo mensal estimado da nova unidade"
                  type="number"
                  min={0}
                  value={expansionMonthlyCost}
                  onChange={(e) => setExpansionMonthlyCost(Number(e.target.value) || 0)}
                />
                <TextField
                  label="Investimento inicial de abertura"
                  type="number"
                  min={0}
                  value={setupCost}
                  onChange={(e) => setSetupCost(Number(e.target.value) || 0)}
                />
                <p className="text-2xs text-ink-faint">
                  Base: média de {formatCurrency(data.avg_monthly_revenue_per_unit)}/mês entre {data.sibling_units_count}{" "}
                  outra(s) unidade(s) do grupo.
                </p>
              </div>
              <ResultCard
                netGain={expansionNetGain}
                detailLine={`Faturamento médio das outras unidades: ${formatCurrency(data.avg_monthly_revenue_per_unit)}/mês`}
                paybackMonths={expansionPaybackMonths}
                noPaybackInputMessage="Sem investimento inicial informado — ganho já positivo desde o 1º mês."
                negativeMessage="Nesta base, a nova unidade NÃO se paga com esses parâmetros."
              />
            </div>
          )}
        </BentoCard>
      </BentoGrid>
    </div>
  );
}
