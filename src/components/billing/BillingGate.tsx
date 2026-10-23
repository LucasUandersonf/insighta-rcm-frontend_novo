import { useEffect, useRef } from "react";
import { Link, Navigate, Outlet, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Eye, Sparkles } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { daysUntil, usePlan } from "@/lib/plan";
import type { SubscriptionStatus } from "@/lib/types";

/**
 * Porta da cobrança para as telas do sistema.
 *
 *  - Clínica encerrada (ou sem acesso e fora do modo leitura): vai para
 *    /assinatura.
 *  - Teste acabou ou assinatura não paga (`read_only`): fica no sistema em
 *    modo leitura, com um aviso no topo; gravar responde 402 e a tela mostra
 *    a mensagem do backend.
 *  - Teste do Pro: aviso discreto com os dias que faltam.
 *  - Volume do plano a 80% / acima do limite: aviso com os números.
 *
 * Se a consulta falhar, deixa passar: quem bloqueia de verdade é o backend.
 */
export function BillingGate() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["subscription", "status"],
    queryFn: () => apiClient.get<SubscriptionStatus>("/api/v1/subscription"),
    staleTime: 60_000,
    retry: false,
  });
  const { usage } = usePlan();
  const readOnlyRef = useRef(false);
  readOnlyRef.current = !!data?.read_only;

  useEffect(() => {
    function onBillingRequired() {
      queryClient.invalidateQueries({ queryKey: ["subscription", "status"] });
      // Em modo leitura, uma gravação recusada não tira a pessoa da tela.
      if (!readOnlyRef.current) navigate("/assinatura", { replace: true });
    }
    window.addEventListener("billing:required", onBillingRequired);
    return () => window.removeEventListener("billing:required", onBillingRequired);
  }, [navigate, queryClient]);

  if (data?.billing_required && !data.access_allowed && !data.read_only) return <Navigate to="/assinatura" replace />;

  const trialDays = data?.in_trial ? daysUntil(data.trial_ends_at) : null;
  const volume = usage?.appointments;

  return (
    <>
      {data?.read_only ? (
        <Banner tone="warn" icon={<Eye aria-hidden size={14} />}>
          Modo leitura: o teste terminou ou a assinatura não está paga. Você continua vendo tudo; para importar e editar,
          <Link to="/assinatura" className="font-medium text-accent underline-offset-2 hover:underline">
            escolha um plano
          </Link>
          .
        </Banner>
      ) : data?.billing_required && data.billing_status === "past_due" ? (
        <Banner tone="danger" icon={<AlertTriangle aria-hidden size={14} className="text-denied" />}>
          Há uma cobrança da assinatura em aberto.
          <Link to="/assinatura" className="font-medium text-accent underline-offset-2 hover:underline">
            Pagar agora
          </Link>
        </Banner>
      ) : trialDays !== null ? (
        <Banner tone="info" icon={<Sparkles aria-hidden size={14} className="text-accent" />}>
          Teste do Pro: {trialDays === 1 ? "falta 1 dia" : `faltam ${trialDays} dias`}.
          <Link to="/assinatura" className="font-medium text-accent underline-offset-2 hover:underline">
            Escolher plano
          </Link>
        </Banner>
      ) : null}
      {volume && volume.limit && volume.state !== "ok" && (
        <Banner tone={volume.state === "warn" ? "info" : "warn"} icon={<AlertTriangle aria-hidden size={14} />}>
          {volume.state === "blocked"
            ? `Importação pausada: ${volume.used} atendimentos nos últimos 30 dias, acima do limite do plano (${volume.limit}). Seus dados continuam disponíveis.`
            : volume.state === "over"
              ? `${volume.used} atendimentos nos últimos 30 dias, acima do limite do plano (${volume.limit}).`
              : `${volume.used} de ${volume.limit} atendimentos do plano nos últimos 30 dias.`}
          <Link to="/assinatura" className="font-medium text-accent underline-offset-2 hover:underline">
            Ver o Pro
          </Link>
        </Banner>
      )}
      <Outlet />
    </>
  );
}

function Banner({ tone, icon, children }: { tone: "info" | "warn" | "danger"; icon: React.ReactNode; children: React.ReactNode }) {
  const bg = tone === "danger" ? "bg-denied-bg" : tone === "warn" ? "bg-pending-bg" : "bg-accent-bg";
  return (
    <div role="status" className={`flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-4 py-2 text-center text-sm text-ink ${bg}`}>
      {icon}
      {children}
    </div>
  );
}
