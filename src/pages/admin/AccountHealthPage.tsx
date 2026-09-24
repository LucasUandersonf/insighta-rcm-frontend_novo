import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { HeartPulse } from "lucide-react";
import { Panel, LoadingState, ErrorState } from "@/components/ui/Panel";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import type { AccountHealth, AccountHealthCheck } from "@/lib/types";

const GROUPS: { id: AccountHealthCheck["group"]; title: string; subtitle: string }[] = [
  { id: "dados", title: "Dados", subtitle: "O que alimenta os insights de cada área." },
  { id: "equipe", title: "Equipe", subtitle: "Quem recebe os alertas e a grade que calcula a ocupação." },
  { id: "configuracao", title: "Configuração", subtitle: "Meta, e-mail, IA e as atualizações automáticas." },
];

const STATUS: Record<AccountHealthCheck["status"], { label: string; tone: BadgeTone }> = {
  ok: { label: "Tudo certo", tone: "revenue" },
  atencao: { label: "Atenção", tone: "pending" },
  pendente: { label: "Pendente", tone: "denied" },
};

/**
 * Bloco 2 (autonomia) — "Saúde da conta": tudo o que precisa estar ligado
 * para o Insighta funcionar, o que falta e onde resolver. Cada item é uma
 * pergunta que viraria chamado ("por que o convite não chegou?").
 */
export function AccountHealthPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["tenant", "account-health"],
    queryFn: () => apiClient.get<AccountHealth>("/api/v1/tenant/account-health"),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        icon={HeartPulse}
        title="Saúde da conta"
        subtitle={
          data
            ? data.attention_count === 0
              ? "Tudo configurado — o Insighta está trabalhando com dados completos."
              : `${data.attention_count} ${data.attention_count === 1 ? "item precisa" : "itens precisam"} de atenção para o Insighta funcionar por completo.`
            : "O que está ligado e o que falta para o Insighta funcionar por completo."
        }
      />
      {isLoading && <LoadingState rows={6} />}
      {error && <ErrorState message={getApiErrorMessage(error)} onRetry={() => refetch()} />}
      {data &&
        Array.isArray(data.checks) &&
        GROUPS.map((group) => {
          const checks = data.checks.filter((c) => c.group === group.id);
          if (checks.length === 0) return null;
          return (
            <Panel key={group.id} title={group.title} subtitle={group.subtitle}>
              <ul className="divide-y divide-border-hairline">
                {checks.map((check) => (
                  <li key={check.key} className="flex flex-col gap-1.5 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-ink">{check.label}</p>
                      <p className="text-xs text-ink-muted">{check.detail}</p>
                    </div>
                    <Badge tone={STATUS[check.status].tone}>{STATUS[check.status].label}</Badge>
                    {check.action_href && check.action_label && check.status !== "ok" && (
                      <Link to={check.action_href} className="text-xs font-medium text-accent-muted hover:underline">
                        {check.action_label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </Panel>
          );
        })}
    </div>
  );
}
