import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Briefcase, LogOut } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ErrorState, LoadingState } from "@/components/ui/Panel";
import { ApiError } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { brlWhole } from "@/lib/team";
import {
  clearPartnerSession,
  enterClinic,
  partnerApiClient,
  type PortfolioClinic,
} from "@/lib/partner-api-client";

const ROLE_LABEL: Record<string, string> = { financeiro: "Financeiro", auditor: "Só leitura" };

function money(v: number | null): string {
  return v == null ? "—" : brlWhole(v);
}

/**
 * Carteira do parceiro (v1.1): uma linha por clínica que autorizou o
 * escritório, em ordem de urgência (dado parado, depois R$ a recuperar).
 * "Abrir" entra na clínica com o papel que ela liberou.
 */
export function PortfolioPage() {
  const navigate = useNavigate();
  const [opening, setOpening] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const [tab, setTab] = useState<"carteira" | "comissao">("carteira");

  const me = useQuery({ queryKey: ["partner", "me"], queryFn: partnerApiClient.me, retry: false });
  const portfolio = useQuery({ queryKey: ["partner", "portfolio"], queryFn: partnerApiClient.portfolio, retry: false });
  const isAdmin = me.data?.role === "partner_admin";
  const commission = useQuery({
    queryKey: ["partner", "commission"],
    queryFn: () => partnerApiClient.commission(),
    enabled: tab === "comissao" && isAdmin,
    retry: false,
  });

  // Sessão do parceiro caiu (expirou, foi encerrada ou a senha temporária
  // ainda não foi trocada): volta para a entrada.
  const authError = [me.error, portfolio.error].find((e) => e instanceof ApiError && (e.status === 401 || e.status === 403));
  useEffect(() => {
    if (authError) {
      clearPartnerSession();
      navigate("/parceiro/login", { replace: true });
    }
  }, [authError, navigate]);

  async function open(clinic: PortfolioClinic) {
    setOpenError(null);
    setOpening(clinic.tenant_id);
    try {
      const session = await partnerApiClient.openClinic(clinic.tenant_id);
      enterClinic(session, portfolio.data?.partner_name ?? "");
    } catch (err) {
      setOpenError(getApiErrorMessage(err));
      setOpening(null);
    }
  }

  async function logout() {
    await partnerApiClient.logout().catch(() => {});
    clearPartnerSession();
    navigate("/parceiro/login", { replace: true });
  }

  const data = portfolio.data;
  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-border-hairline bg-canvas-raised">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-3 px-4 py-3 sm:px-8">
          <div className="flex min-w-0 items-center gap-2">
            <Briefcase aria-hidden size={18} className="shrink-0 text-accent" />
            <span className="truncate text-sm font-semibold text-ink">{data?.partner_name ?? "Insighta para parceiros"}</span>
          </div>
          <div className="flex items-center gap-3">
            {me.data && <span className="hidden text-xs text-ink-muted sm:inline">{me.data.full_name}</span>}
            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut aria-hidden size={14} /> Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1280px] px-4 pb-14 pt-6 sm:px-8">
        <h1 className="text-xl font-semibold text-ink">Carteira</h1>
        <p className="mt-1 text-sm text-ink-muted">As clínicas que autorizaram o seu escritório, das que mais pedem atenção para as que menos pedem.</p>

        {isAdmin && (
          <div role="tablist" aria-label="Seções" className="mt-5 flex gap-2">
            {(["carteira", "comissao"] as const).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`rounded-md px-3 py-1.5 text-sm ${tab === t ? "bg-accent text-white" : "text-ink-muted hover:bg-canvas-inset"}`}
              >
                {t === "carteira" ? "Carteira" : "Comissão"}
              </button>
            ))}
          </div>
        )}

        {tab === "comissao" && isAdmin ? (
          <section className="mt-5">
            {commission.isLoading && <LoadingState rows={3} />}
            {commission.error && <ErrorState message={getApiErrorMessage(commission.error)} onRetry={() => commission.refetch()} />}
            {commission.data && (
              <>
                <p className="text-sm text-ink-muted">
                  {commission.data.month.split("-").reverse().join("/")} · {commission.data.commission_pct}% sobre a mensalidade paga de cada clínica.
                </p>
                <div className="mt-3 overflow-x-auto rounded-lg border border-border-hairline bg-canvas-raised">
                  <table className="w-full text-sm">
                    <thead className="text-left text-2xs uppercase tracking-wide text-ink-faint">
                      <tr><th className="px-4 py-2">Clínica</th><th className="px-4 py-2 text-right">Mensalidade paga</th><th className="px-4 py-2 text-right">Comissão</th></tr>
                    </thead>
                    <tbody>
                      {commission.data.lines.map((l) => (
                        <tr key={l.tenant_id} className="border-t border-border-hairline">
                          <td className="px-4 py-2 text-ink">{l.trade_name}</td>
                          <td className="px-4 py-2 text-right tabular-nums">{money(l.subscription_paid)}</td>
                          <td className="px-4 py-2 text-right tabular-nums">{money(l.commission)}</td>
                        </tr>
                      ))}
                      <tr className="border-t border-border-default font-semibold">
                        <td className="px-4 py-2">Total</td>
                        <td className="px-4 py-2 text-right tabular-nums">{money(commission.data.total_paid)}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{money(commission.data.total_commission)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        ) : (
          <section className="mt-5">
            {portfolio.isLoading && <LoadingState rows={4} />}
            {portfolio.error && !(portfolio.error instanceof ApiError && [401, 403].includes(portfolio.error.status)) && (
              <ErrorState message={getApiErrorMessage(portfolio.error)} onRetry={() => portfolio.refetch()} />
            )}
            {data && (
              <>
                <dl className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-border-hairline bg-canvas-raised p-4">
                    <dt className="text-2xs uppercase tracking-wide text-ink-faint">Clínicas</dt>
                    <dd className="mt-1 text-2xl font-semibold tabular-nums text-ink">{data.clinics.length}</dd>
                  </div>
                  <div className="rounded-lg border border-border-hairline bg-canvas-raised p-4">
                    <dt className="text-2xs uppercase tracking-wide text-ink-faint">A recuperar na carteira</dt>
                    <dd className="mt-1 text-2xl font-semibold tabular-nums text-ink">{brlWhole(data.total_recoverable)}</dd>
                  </div>
                  <div className="rounded-lg border border-border-hairline bg-canvas-raised p-4">
                    <dt className="text-2xs uppercase tracking-wide text-ink-faint">Pedem atenção</dt>
                    <dd className="mt-1 text-2xl font-semibold tabular-nums text-ink">{data.clinics_needing_attention}</dd>
                  </div>
                </dl>

                {openError && (
                  <div role="alert" className="mt-4 rounded-md border border-denied/25 bg-denied-bg px-3 py-2 text-xs text-denied">{openError}</div>
                )}

                {data.clinics.length === 0 ? (
                  <div className="mt-6 rounded-lg border border-dashed border-border-default p-6 text-sm text-ink-muted">
                    Nenhuma clínica autorizou o seu escritório ainda. Peça ao responsável pela clínica para entrar no Insighta,
                    abrir <strong>Parceiros</strong> no menu da conta e informar o CNPJ do seu escritório.
                  </div>
                ) : (
                  <ul className="mt-6 space-y-3">
                    {data.clinics.map((c) => (
                      <li key={c.tenant_id} className="rounded-lg border border-border-hairline bg-canvas-raised p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className="text-base font-semibold text-ink">{c.trade_name}</h2>
                              <Badge tone="neutral">{ROLE_LABEL[c.acting_role] ?? c.acting_role}</Badge>
                              {(c.stale_level ?? 0) >= 1 && <Badge tone={(c.stale_level ?? 0) >= 3 ? "denied" : "pending"}>Dado parado</Badge>}
                            </div>
                            {c.attention.length > 0 && (
                              <ul className="mt-1.5 space-y-0.5">
                                {c.attention.map((a) => (
                                  <li key={a} className="flex items-center gap-1.5 text-xs text-pending">
                                    <AlertTriangle aria-hidden size={12} /> {a}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                          <Button size="sm" onClick={() => open(c)} disabled={opening !== null}>
                            {opening === c.tenant_id ? "Abrindo..." : "Abrir clínica"}
                          </Button>
                        </div>
                        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-5">
                          <div><dt className="text-ink-faint">Faturado 30 dias</dt><dd className="tabular-nums text-ink">{money(c.billed_30d)}</dd></div>
                          <div><dt className="text-ink-faint">A recuperar</dt><dd className="tabular-nums text-ink">{money(c.recoverable)}</dd></div>
                          <div><dt className="text-ink-faint">Vence em 7 dias</dt><dd className="tabular-nums text-ink">{money(c.due_7_days)}</dd></div>
                          <div><dt className="text-ink-faint">Recuperado no mês</dt><dd className="tabular-nums text-ink">{money(c.recovered_month)}</dd></div>
                          <div><dt className="text-ink-faint">Demandas abertas</dt><dd className="tabular-nums text-ink">{c.open_demands ?? "—"}</dd></div>
                        </dl>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
