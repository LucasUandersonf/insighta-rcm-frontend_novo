import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { brl } from "@/components/money/PreSubmissionIssues";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/context/AuthContext";
import type { BillingBridge as Bridge } from "@/lib/types";

const CAN_VIEW = ["owner", "admin", "financeiro", "auditor"];

function Step({ label, value, sign, tone }: { label: string; value: number; sign: "" | "−" | "="; tone?: string }) {
  return (
    <li className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="text-sm text-ink-muted">
        {sign && <span className="mr-1.5 inline-block w-3 text-ink-faint">{sign}</span>}
        {label}
      </span>
      <span className={`tabular text-sm font-medium ${tone ?? "text-ink"}`}>{brl(value)}</span>
    </li>
  );
}

/**
 * Ponte do faturado ao recebido, em degraus, para as contas dos últimos 90
 * dias: o que voltou glosado, o que ainda está em aberto, o imposto retido
 * pelo convênio e a diferença que nada disso explica.
 */
export function BillingBridge() {
  const { user } = useAuth();
  const canView = !!user && CAN_VIEW.includes(user.role);
  const { data } = useQuery({
    queryKey: ["financeiro", "ponte"],
    queryFn: () => apiClient.get<Bridge>("/api/v1/financeiro/ponte?days=90"),
    enabled: canView,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
  if (!canView || !data || data.billed <= 0) return null;
  const missing = data.plans_with_billing - data.confirmed_plans;

  return (
    <section aria-labelledby="ponte-faturado-recebido">
      <h2 id="ponte-faturado-recebido" className="mb-1 text-sm font-medium text-ink">
        Do faturado ao recebido · últimos 90 dias
      </h2>
      <p className="mb-2 text-xs text-ink-muted">Por que entrou menos do que foi faturado, degrau por degrau.</p>
      <ul className="divide-y divide-border-hairline rounded-lg border border-border-hairline bg-glass px-4">
        <Step label="Faturado" value={data.billed} sign="" />
        <Step label="Glosado" value={data.denied} sign="−" tone="text-denied" />
        <Step label="Ainda em aberto" value={data.open} sign="−" />
        <Step label="Retido na fonte (impostos)" value={data.withholding} sign="−" />
        {Math.abs(data.unexplained) >= 0.01 && (
          <Step
            label={data.unexplained > 0 ? "Pago a menos, sem explicação" : "Recebido a mais"}
            value={Math.abs(data.unexplained)}
            sign="−"
            tone={data.unexplained > 0 ? "text-denied" : "text-revenue"}
          />
        )}
        <Step label="Recebido" value={data.received} sign="=" tone="text-revenue" />
      </ul>
      {missing > 0 && (
        <p className="mt-2 text-2xs text-ink-faint">
          Retenção confirmada em {data.confirmed_plans} de {data.plans_with_billing} convênios; nos outros, o imposto aparece como
          pago a menos.{" "}
          <Link to="/convenios?tab=prazos" className="font-medium text-accent hover:underline">
            Confirmar retenções
          </Link>
        </p>
      )}
    </section>
  );
}
