import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Briefcase } from "lucide-react";
import { getApiErrorMessage } from "@/lib/query-client";
import { enterClinic, getPartnerClinic, getStoredPartnerToken, leaveClinic, partnerApiClient } from "@/lib/partner-api-client";

const ROLE_LABEL: Record<string, string> = { financeiro: "financeiro", auditor: "só leitura" };

/**
 * Insighta Partner (v1.1): faixa fixa enquanto o parceiro está dentro de
 * uma clínica — deixa claro em nome de quem ele está ("Você está na
 * Clínica X"), troca de clínica sem voltar à carteira e volta à carteira.
 */
export function PartnerClinicBanner() {
  const clinic = getPartnerClinic();
  const [error, setError] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);
  const portfolio = useQuery({
    queryKey: ["partner", "portfolio"],
    queryFn: partnerApiClient.portfolio,
    enabled: !!clinic && !!getStoredPartnerToken(),
    retry: false,
    staleTime: 60_000,
  });
  if (!clinic) return null;

  async function switchTo(tenantId: string) {
    if (!tenantId || tenantId === clinic?.tenant_id) return;
    setError(null);
    setSwitching(true);
    try {
      enterClinic(await partnerApiClient.openClinic(tenantId), clinic?.partner_name ?? "");
    } catch (err) {
      setError(getApiErrorMessage(err));
      setSwitching(false);
    }
  }

  const others = (portfolio.data?.clinics ?? []).filter((c) => c.tenant_id !== clinic.tenant_id);
  return (
    <div role="region" aria-label="Acesso de parceiro" className="border-b border-accent/30 bg-accent-bg text-accent">
      <div className="mx-auto flex max-w-[1680px] flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2 text-xs sm:px-8">
        <span className="flex items-center gap-1.5 font-semibold">
          <Briefcase aria-hidden size={13} />
          Você está na {clinic.trade_name}
        </span>
        <span className="text-accent/80">
          como {clinic.partner_name || "parceiro"} · {ROLE_LABEL[clinic.role] ?? clinic.role}
        </span>
        {others.length > 0 && (
          <label className="flex items-center gap-1.5">
            <span>Trocar de clínica</span>
            <select
              className="rounded-md border border-accent/30 bg-canvas-raised px-2 py-1 text-xs text-ink"
              value=""
              disabled={switching}
              onChange={(e) => void switchTo(e.target.value)}
            >
              <option value="">Escolher…</option>
              {others.map((c) => (
                <option key={c.tenant_id} value={c.tenant_id}>
                  {c.trade_name}
                </option>
              ))}
            </select>
          </label>
        )}
        <button type="button" onClick={leaveClinic} className="ml-auto font-semibold underline">
          Voltar à carteira
        </button>
        {error && (
          <span role="alert" className="w-full text-denied">
            {error}
          </span>
        )}
      </div>
    </div>
  );
}
