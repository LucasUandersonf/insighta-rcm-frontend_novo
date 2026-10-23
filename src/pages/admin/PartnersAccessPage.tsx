import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SelectField, TextField } from "@/components/ui/FormField";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, ErrorState, LoadingState, Panel } from "@/components/ui/Panel";
import { useToast } from "@/context/ToastContext";
import { apiClient } from "@/lib/api-client";
import { formatCNPJ } from "@/lib/masks";
import { getApiErrorMessage } from "@/lib/query-client";

interface PartnerGrant {
  id: string;
  partner_id: string;
  partner_name: string;
  partner_cnpj: string;
  status: "ativo" | "revogado";
  acting_role: "financeiro" | "auditor";
  granted_at: string;
  revoked_at: string | null;
  last_session_at: string | null;
}

const ROLE_OPTIONS = [
  { value: "financeiro", label: "Financeiro (pode importar e tratar cobranças)" },
  { value: "auditor", label: "Só leitura" },
];

function date(value: string | null): string {
  return value ? new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "nunca";
}

/**
 * Parceiros (v1.1): o dono ou administrador autoriza o contador ou a
 * consultoria pelo CNPJ do escritório, escolhe o que ele pode fazer e
 * revoga quando quiser. Cada entrada do parceiro aparece nos Logs de
 * auditoria ("partner.session_started").
 */
export function PartnersAccessPage() {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [cnpj, setCnpj] = useState("");
  const [role, setRole] = useState<"financeiro" | "auditor">("financeiro");
  const [toRevoke, setToRevoke] = useState<PartnerGrant | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const grants = useQuery({ queryKey: ["partner-access"], queryFn: () => apiClient.get<PartnerGrant[]>("/api/v1/partner-access") });
  const setData = (rows: PartnerGrant[]) => queryClient.setQueryData(["partner-access"], rows);

  const grant = useMutation({
    mutationFn: () => apiClient.post<PartnerGrant[]>("/api/v1/partner-access", { cnpj, acting_role: role }),
    onSuccess: (rows) => {
      setData(rows);
      setCnpj("");
      setFormError(null);
      showSuccess("Parceiro autorizado. Ele já vê a clínica na carteira dele.");
    },
    onError: (err) => setFormError(getApiErrorMessage(err)),
  });
  const changeRole = useMutation({
    mutationFn: ({ id, acting_role }: { id: string; acting_role: string }) =>
      apiClient.patch<PartnerGrant[]>(`/api/v1/partner-access/${id}`, { acting_role }),
    onSuccess: (rows) => {
      setData(rows);
      showSuccess("Permissão do parceiro atualizada.");
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => apiClient.delete<PartnerGrant[]>(`/api/v1/partner-access/${id}`),
    onSuccess: (rows) => {
      setData(rows);
      setToRevoke(null);
      showSuccess("Acesso do parceiro revogado. Se ele estava dentro, saiu agora.");
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    grant.mutate();
  }

  const rows = grants.data ?? [];
  return (
    <div className="space-y-6">
      <PageHeader
        title="Parceiros"
        subtitle="Dê ao seu contador ou consultoria acesso à clínica sem criar um usuário para cada pessoa do escritório."
      />

      <Panel title="Autorizar um parceiro" subtitle="Peça o CNPJ do escritório. Ele precisa já ser parceiro do Insighta.">
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <TextField label="CNPJ do escritório" inputMode="numeric" required value={cnpj} onChange={(e) => setCnpj(formatCNPJ(e.target.value))} />
          <SelectField label="O que ele pode fazer" value={role} onChange={(e) => setRole(e.target.value as "financeiro" | "auditor")}>
            {ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </SelectField>
          <Button type="submit" disabled={grant.isPending || cnpj.replace(/\D/g, "").length !== 14} className="mb-4">
            {grant.isPending ? "Autorizando..." : "Autorizar"}
          </Button>
        </form>
        {formError && (
          <div role="alert" className="rounded-md border border-denied/25 bg-denied-bg px-3 py-2 text-xs text-denied">
            {formError}
          </div>
        )}
      </Panel>

      <Panel title="Quem tem acesso">
        {grants.isLoading && <LoadingState rows={3} />}
        {grants.error && <ErrorState message={getApiErrorMessage(grants.error)} onRetry={() => grants.refetch()} />}
        {grants.data && rows.length === 0 && <EmptyState message="Nenhum parceiro autorizado." />}
        {rows.length > 0 && (
          <ul className="divide-y divide-border-hairline">
            {rows.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-ink">{g.partner_name}</span>
                    <Badge tone={g.status === "ativo" ? "revenue" : "neutral"}>{g.status === "ativo" ? "Ativo" : "Revogado"}</Badge>
                  </div>
                  <p className="text-xs text-ink-faint">
                    CNPJ {formatCNPJ(g.partner_cnpj)} · última entrada: {date(g.last_session_at)}
                  </p>
                </div>
                {g.status === "ativo" && (
                  <div className="flex items-center gap-2">
                    <label className="sr-only" htmlFor={`role-${g.id}`}>Permissão de {g.partner_name}</label>
                    <select
                      id={`role-${g.id}`}
                      className="rounded-md border border-border-default bg-canvas-raised px-2 py-1.5 text-xs text-ink"
                      value={g.acting_role}
                      disabled={changeRole.isPending}
                      onChange={(e) => changeRole.mutate({ id: g.id, acting_role: e.target.value })}
                    >
                      {ROLE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.value === "financeiro" ? "Financeiro" : "Só leitura"}
                        </option>
                      ))}
                    </select>
                    <Button variant="secondary" size="sm" aria-label={`Revogar acesso de ${g.partner_name}`} onClick={() => setToRevoke(g)}>
                      Revogar
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <ConfirmDialog
        isOpen={!!toRevoke}
        title="Revogar acesso do parceiro?"
        message={`${toRevoke?.partner_name ?? ""} deixa de ver a clínica agora. Você pode autorizar de novo depois.`}
        confirmLabel="Revogar"
        onConfirm={() => toRevoke && revoke.mutate(toRevoke.id)}
        onCancel={() => setToRevoke(null)}
        isConfirming={revoke.isPending}
      />
    </div>
  );
}
