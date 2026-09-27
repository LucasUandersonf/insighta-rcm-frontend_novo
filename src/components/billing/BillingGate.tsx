import { useEffect } from "react";
import { Link, Navigate, Outlet, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import type { SubscriptionStatus } from "@/lib/types";

/**
 * Porta da cobrança para as telas do sistema. Quando o backend exige
 * pagamento (billing_required) e a clínica não está liberada, leva para
 * /assinatura. Durante a carência de uma cobrança vencida, mostra um aviso
 * no topo. Se a consulta falhar, deixa passar: quem bloqueia de verdade é
 * o backend (402), e o evento "billing:required" do api-client traz o
 * usuário de volta para cá.
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

  useEffect(() => {
    function onBillingRequired() {
      queryClient.invalidateQueries({ queryKey: ["subscription", "status"] });
      navigate("/assinatura", { replace: true });
    }
    window.addEventListener("billing:required", onBillingRequired);
    return () => window.removeEventListener("billing:required", onBillingRequired);
  }, [navigate, queryClient]);

  if (data?.billing_required && !data.access_allowed) return <Navigate to="/assinatura" replace />;

  return (
    <>
      {data?.billing_required && data.billing_status === "past_due" && (
        <div role="status" className="flex items-center justify-center gap-2 bg-denied-bg px-4 py-2 text-center text-sm text-ink">
          <AlertTriangle aria-hidden size={14} className="text-denied" />
          Há uma cobrança da assinatura em aberto.
          <Link to="/assinatura" className="font-medium text-accent underline-offset-2 hover:underline">
            Pagar agora
          </Link>
        </div>
      )}
      <Outlet />
    </>
  );
}
