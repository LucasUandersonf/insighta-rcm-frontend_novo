import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { SelectField, TextField } from "@/components/ui/FormField";
import { Panel } from "@/components/ui/Panel";
import { formatCNPJ } from "@/lib/masks";
import { getApiErrorMessage } from "@/lib/query-client";
import { platformApiClient, type PlatformPartnerCreate } from "@/lib/platform-api-client";

const EMPTY: PlatformPartnerCreate = { legal_name: "", cnpj: "", kind: "contabilidade", commission_pct: 0, admin_email: "", admin_name: "" };

/** Insighta Partner (v1.1): cadastro do escritório parceiro e do primeiro
 * acesso. A senha temporária aparece uma vez só, para repassar ao parceiro;
 * no primeiro login ele troca a senha e cadastra o autenticador. */
export function PlatformPartnersPanel() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<PlatformPartnerCreate>(EMPTY);
  const [created, setCreated] = useState<{ admin_email: string; temporary_password: string } | null>(null);
  const partners = useQuery({ queryKey: ["platform", "partners"], queryFn: platformApiClient.getPartners });
  const create = useMutation({
    mutationFn: () => platformApiClient.createPartner(form),
    onSuccess: (res) => {
      setCreated(res);
      setForm(EMPTY);
      void queryClient.invalidateQueries({ queryKey: ["platform", "partners"] });
    },
  });

  const set = <K extends keyof PlatformPartnerCreate>(key: K, value: PlatformPartnerCreate[K]) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <Panel title="Parceiros" subtitle="Contadores e consultorias com carteira de clínicas. Cada clínica autoriza o parceiro pelo CNPJ.">
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          setCreated(null);
          create.mutate();
        }}
        className="grid gap-x-3 sm:grid-cols-3"
      >
        <TextField label="Razão social" required value={form.legal_name} onChange={(e) => set("legal_name", e.target.value)} />
        <TextField label="CNPJ" required inputMode="numeric" value={form.cnpj} onChange={(e) => set("cnpj", formatCNPJ(e.target.value))} />
        <SelectField label="Tipo" value={form.kind} onChange={(e) => set("kind", e.target.value as PlatformPartnerCreate["kind"])}>
          <option value="contabilidade">Contabilidade</option>
          <option value="consultoria">Consultoria</option>
          <option value="outro">Outro</option>
        </SelectField>
        <TextField label="Nome de quem acessa" required value={form.admin_name} onChange={(e) => set("admin_name", e.target.value)} />
        <TextField label="E-mail de quem acessa" type="email" required value={form.admin_email} onChange={(e) => set("admin_email", e.target.value)} />
        <TextField
          label="Comissão (%)"
          type="number"
          min={0}
          max={50}
          step="0.5"
          value={String(form.commission_pct)}
          onChange={(e) => set("commission_pct", Number(e.target.value))}
        />
        <div className="sm:col-span-3">
          <Button type="submit" size="sm" disabled={create.isPending}>
            {create.isPending ? "Cadastrando..." : "Cadastrar parceiro"}
          </Button>
        </div>
      </form>
      {create.error && (
        <div role="alert" className="mt-3 rounded-md border border-denied/25 bg-denied-bg px-3 py-2 text-xs text-denied">
          {getApiErrorMessage(create.error)}
        </div>
      )}
      {created && (
        <div role="status" className="mt-3 rounded-md border border-revenue/25 bg-revenue-bg px-3 py-2 text-xs text-revenue">
          Acesso criado para {created.admin_email}. Senha temporária (aparece só agora):{" "}
          <code className="font-semibold">{created.temporary_password}</code>. Entrada em /parceiro/login.
        </div>
      )}
      {(partners.data ?? []).length > 0 && (
        <div className="mt-4 overflow-x-auto" tabIndex={0}>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border-hairline text-xs text-ink-muted">
                <th className="px-4 py-2 font-medium">Parceiro</th>
                <th className="px-4 py-2 font-medium">CNPJ</th>
                <th className="px-4 py-2 font-medium">Clínicas</th>
                <th className="px-4 py-2 font-medium">Comissão</th>
              </tr>
            </thead>
            <tbody>
              {partners.data!.map((p) => (
                <tr key={p.id} className="border-b border-border-hairline last:border-0">
                  <td className="px-4 py-2 text-ink">{p.legal_name}</td>
                  <td className="px-4 py-2 font-mono text-ink-muted">{formatCNPJ(p.cnpj)}</td>
                  <td className="px-4 py-2 tabular-nums">{p.active_clinics}</td>
                  <td className="px-4 py-2 tabular-nums">{p.commission_pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
