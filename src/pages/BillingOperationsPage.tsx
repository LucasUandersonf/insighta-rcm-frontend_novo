import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileStack, Wallet } from "lucide-react";
import { Panel, EmptyState, LoadingState, ErrorState } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { TextField, SelectField } from "@/components/ui/FormField";
import { Pagination } from "@/components/ui/Pagination";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { BillingSearchPicker } from "@/components/billing/BillingSearchPicker";
import { apiClient, ApiError } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { useToast } from "@/context/ToastContext";
import type { BillingSearchItem, Guia, GuiaCreateRequest, GuiaTipo, InsurancePlan, PaginatedResponse } from "@/lib/types";

// Faturamento & Guias — as DUAS pontas do ciclo de vida da fatura que já
// funcionavam de ponta a ponta no backend sem nenhuma tela: registrar o
// que a operadora efetivamente pagou (POST /billing/{id}/settle) e
// cadastrar a Guia TISS manualmente (POST /guias, além do que a
// ingestão de Faturamento já preenche sozinha via colunas
// guia_tipo/guia_numero/guia_senha). Achado do Raio-X da Sala de
// Comando: a lacuna era só de UI, não de lógica de negócio.

type Tab = "pagamento" | "guias";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));
}

// ---------------------------------------------------------------------
// Registrar pagamento recebido
// ---------------------------------------------------------------------

function SettlementTab() {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [selected, setSelected] = useState<BillingSearchItem | null>(null);
  const [receivedValue, setReceivedValue] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: () =>
      apiClient.post(`/api/v1/billing/${selected!.id}/settle`, { received_value: Number(receivedValue) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing"] });
      showSuccess(`Pagamento de ${formatCurrency(Number(receivedValue))} registrado para ${selected!.patient_name}.`);
      setSelected(null);
      setReceivedValue("");
      setFieldErrors({});
    },
    onError: (err) => {
      if (err instanceof ApiError && err.campos) {
        const mapped: Record<string, string> = {};
        for (const c of err.campos) mapped[c.campo] = c.problema;
        setFieldErrors(mapped);
      } else {
        showError(getApiErrorMessage(err));
      }
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    if (!selected) {
      setFieldErrors({ billing: "Busque e selecione o faturamento a liquidar." });
      return;
    }
    const value = Number(receivedValue);
    if (!receivedValue || Number.isNaN(value) || value <= 0) {
      setFieldErrors({ received_value: "Informe um valor recebido maior que zero." });
      return;
    }
    mutation.mutate();
  }

  return (
    <Panel
      title="Registrar pagamento recebido"
      subtitle="Liquidação individual — quanto a operadora efetivamente repassou por este faturamento. Para liquidar um lote inteiro de uma vez, use o Template de Glosa na Central de Upload."
    >
      <form onSubmit={handleSubmit} className="p-4">
        <BillingSearchPicker selected={selected} onSelect={setSelected} error={fieldErrors["billing"]} />
        {selected && (
          <>
            <TextField
              label="Valor recebido"
              type="number"
              step="0.01"
              min="0"
              required
              value={receivedValue}
              onChange={(e) => setReceivedValue(e.target.value)}
              error={fieldErrors["received_value"]}
            />
            {selected.charged_value !== Number(receivedValue) && receivedValue !== "" && !Number.isNaN(Number(receivedValue)) && (
              <p className="-mt-2 mb-4 text-2xs text-ink-faint">
                Cobrado: {formatCurrency(selected.charged_value)} · Diferença:{" "}
                <span className={Number(receivedValue) < selected.charged_value ? "text-denied" : "text-revenue"}>
                  {formatCurrency(Number(receivedValue) - selected.charged_value)}
                </span>
              </p>
            )}
          </>
        )}
        <div className="mt-1 flex justify-end">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Registrando..." : "Registrar pagamento"}
          </Button>
        </div>
      </form>
    </Panel>
  );
}

// ---------------------------------------------------------------------
// Guias (TISS)
// ---------------------------------------------------------------------

const GUIA_TIPO_LABELS: Record<GuiaTipo, string> = {
  consulta: "Consulta",
  sadt: "SP/SADT",
  resumo_internacao: "Resumo de internação",
  honorario: "Honorário individual",
};

const GUIAS_PAGE_SIZE = 15;

function GuiasTab() {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [offset, setOffset] = useState(0);
  const [planId, setPlanId] = useState("");
  const [tipo, setTipo] = useState<GuiaTipo>("sadt");
  const [numero, setNumero] = useState("");
  const [senha, setSenha] = useState("");
  const [tabelaProcedimento, setTabelaProcedimento] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const { data: plans, isLoading: plansLoading } = useQuery({
    queryKey: ["insurance-plans"],
    queryFn: () => apiClient.get<InsurancePlan[]>("/api/v1/insurance-companies/plans"),
  });

  const { data: guiasPage, isLoading, error, refetch } = useQuery({
    queryKey: ["guias", offset],
    queryFn: () => apiClient.get<PaginatedResponse<Guia>>(`/api/v1/guias?limit=${GUIAS_PAGE_SIZE}&offset=${offset}`),
  });

  const mutation = useMutation({
    mutationFn: (payload: GuiaCreateRequest) => apiClient.post<Guia>("/api/v1/guias", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guias"] });
      showSuccess("Guia cadastrada.");
      setPlanId("");
      setNumero("");
      setSenha("");
      setTabelaProcedimento("");
      setFieldErrors({});
    },
    onError: (err) => {
      if (err instanceof ApiError && err.campos) {
        const mapped: Record<string, string> = {};
        for (const c of err.campos) mapped[c.campo] = c.problema;
        setFieldErrors(mapped);
      } else {
        showError(getApiErrorMessage(err));
      }
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    if (!planId) {
      setFieldErrors({ insurance_plan_id: "Selecione um convênio." });
      return;
    }
    mutation.mutate({
      insurance_plan_id: planId,
      tipo,
      numero: numero || null,
      senha: senha || null,
      tabela_procedimento: tabelaProcedimento || null,
    });
  }

  const plansById = new Map((plans ?? []).map((p) => [p.id, p.display_name]));

  return (
    <div className="space-y-4">
      <Panel
        title="Nova guia"
        subtitle="A maioria das guias já entra sozinha pela ingestão de Faturamento (colunas guia_tipo/guia_numero/guia_senha do template) — use este formulário só para casos avulsos, cadastrados antes do faturamento em si."
      >
        <form onSubmit={handleSubmit} className="p-4">
          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="Convênio"
              required
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              error={fieldErrors["insurance_plan_id"]}
            >
              <option value="">{plansLoading ? "Carregando..." : "Selecione..."}</option>
              {(plans ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.display_name}
                </option>
              ))}
            </SelectField>
            <SelectField label="Tipo" required value={tipo} onChange={(e) => setTipo(e.target.value as GuiaTipo)}>
              {Object.entries(GUIA_TIPO_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Número da guia"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              error={fieldErrors["numero"]}
            />
            <TextField label="Senha de autorização" value={senha} onChange={(e) => setSenha(e.target.value)} />
          </div>
          <TextField
            label="Tabela de procedimento (ex.: 18=CBHPM, 22=TUSS)"
            value={tabelaProcedimento}
            onChange={(e) => setTabelaProcedimento(e.target.value)}
          />
          <div className="mt-1 flex justify-end">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Salvando..." : "Cadastrar guia"}
            </Button>
          </div>
        </form>
      </Panel>

      <Panel title="Guias cadastradas" subtitle="Mais recentes primeiro">
        {isLoading && <LoadingState variant="table" rows={4} />}
        {error && <ErrorState message={getApiErrorMessage(error)} onRetry={() => refetch()} />}
        {!isLoading && !error && (guiasPage?.items ?? []).length === 0 && (
          <EmptyState icon={<FileStack size={17} strokeWidth={1.5} />} message="Nenhuma guia cadastrada ainda." />
        )}
        {!isLoading && (guiasPage?.items ?? []).length > 0 && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border-hairline text-2xs uppercase tracking-wide text-ink-faint">
                <th className="px-4 py-2.5 font-medium">Tipo</th>
                <th className="px-4 py-2.5 font-medium">Número</th>
                <th className="px-4 py-2.5 font-medium">Convênio</th>
                <th className="px-4 py-2.5 font-medium">Tabela</th>
                <th className="px-4 py-2.5 font-medium">Lote</th>
                <th className="px-4 py-2.5 font-medium">Criada em</th>
              </tr>
            </thead>
            <tbody>
              {(guiasPage?.items ?? []).map((g) => (
                <tr key={g.id} className="border-b border-border-hairline last:border-0 transition-colors hover:bg-canvas-raised/60">
                  <td className="px-4 py-2.5 text-ink">{GUIA_TIPO_LABELS[g.tipo]}</td>
                  <td className="px-4 py-2.5 text-ink-muted">{g.numero ?? "—"}</td>
                  <td className="px-4 py-2.5 text-ink-muted">{plansById.get(g.insurance_plan_id) ?? "—"}</td>
                  <td className="px-4 py-2.5 text-ink-muted">{g.tabela_procedimento ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    {g.lote_id ? <Badge tone="neutral">Atribuída</Badge> : <Badge tone="pending">Sem lote</Badge>}
                  </td>
                  <td className="px-4 py-2.5 text-ink-muted">{formatDate(g.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {guiasPage && guiasPage.total > 0 && (
          <Pagination total={guiasPage.total} limit={GUIAS_PAGE_SIZE} offset={offset} onOffsetChange={setOffset} />
        )}
      </Panel>
    </div>
  );
}

const TABS_GROUP = "faturamento-operacoes";

export function BillingOperationsPage() {
  const [tab, setTab] = useState<Tab>("pagamento");

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Wallet}
        title="Faturamento & guias"
        subtitle="Registre o que a operadora efetivamente pagou e cadastre guias TISS avulsas — as duas pontas do ciclo de faturamento que já existiam no sistema sem nenhuma tela."
      />

      <Tabs
        groupId={TABS_GROUP}
        active={tab}
        onChange={(id) => setTab(id as Tab)}
        items={[
          { id: "pagamento", label: "Registrar pagamento" },
          { id: "guias", label: "Guias" },
        ]}
      />

      {tab === "pagamento" ? <SettlementTab /> : <GuiasTab />}
    </div>
  );
}
