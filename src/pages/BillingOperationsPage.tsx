import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileStack, Search, Wallet } from "lucide-react";
import { Panel, EmptyState, LoadingState, ErrorState } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { TextField, SelectField } from "@/components/ui/FormField";
import { FilterBar } from "@/components/ui/FilterBar";
import { Pagination } from "@/components/ui/Pagination";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { BillingSearchPicker } from "@/components/billing/BillingSearchPicker";
import { apiClient, ApiError } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { useToast } from "@/context/ToastContext";
import type {
  BillingSearchItem,
  Guia,
  GuiaCreateRequest,
  GuiaTipo,
  InsurancePlan,
  PaginatedResponse,
  PaymentMethod,
} from "@/lib/types";

// Faturamento & Guias — as DUAS pontas do ciclo de vida da fatura que já
// funcionavam de ponta a ponta no backend sem nenhuma tela: registrar o
// que a operadora efetivamente pagou (POST /billing/{id}/settle) e
// cadastrar a Guia TISS manualmente (POST /guias, além do que a
// ingestão de Faturamento já preenche sozinha via colunas
// guia_tipo/guia_numero/guia_senha). Achado do Raio-X da Sala de
// Comando: a lacuna era só de UI, não de lógica de negócio.

type Tab = "pagamento" | "coparticipacao" | "auditoria-opme" | "guias";

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
// Confirmação de recebimento de coparticipação (Épico F4.2 do Plano
// Diretor — "Fechar lacunas operacionais"). O sistema já sabia QUANTO
// foi cobrado de coparticipação; faltava confirmar se esse valor de
// fato entrou no caixa no momento do atendimento — a lacuna que os
// insights de coparticipação já existentes deixavam em aberto.
// ---------------------------------------------------------------------

// "Mapa de Dados Insighta" — Domínio Financeiro particular (Onda 1).
const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  dinheiro: "Dinheiro",
  pix: "Pix",
  cartao_debito: "Cartão de débito",
  cartao_credito: "Cartão de crédito",
  boleto: "Boleto",
};

function CoparticipationTab() {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [selected, setSelected] = useState<BillingSearchItem | null>(null);
  // "Mapa de Dados Insighta" — confirmar recebimento É o checkout real
  // do particular (o momento em que a recepção sabe o que aconteceu),
  // o ponto de captura natural pra COMO foi pago — não só QUANTO.
  const [paymentMethod, setPaymentMethod] = useState("");
  const [installments, setInstallments] = useState("");

  const mutation = useMutation({
    mutationFn: (received: boolean) =>
      apiClient.post(`/api/v1/billing/${selected!.id}/confirm-coparticipation`, {
        received,
        payment_method: received ? paymentMethod || null : null,
        installments: received && installments ? Number(installments) : null,
      }),
    onSuccess: (_data, received) => {
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      showSuccess(received ? "Coparticipação confirmada como recebida." : "Registrado: coparticipação NÃO foi recebida.");
      setSelected(null);
      setPaymentMethod("");
      setInstallments("");
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  return (
    <Panel
      title="Confirmar recebimento de coparticipação"
      subtitle="A parte que o próprio paciente paga, à parte do que o convênio cobre — confirme se ela de fato entrou no caixa."
    >
      <div className="p-4">
        <BillingSearchPicker selected={selected} onSelect={setSelected} />
        {selected && selected.coparticipation_value === null && (
          <p className="mt-3 text-2xs text-pending">Este faturamento não tem coparticipação cobrada — nada para confirmar.</p>
        )}
        {selected && selected.coparticipation_value !== null && (
          <div className="mt-3 rounded-md border border-border-hairline bg-canvas-raised/40 p-3">
            <p className="text-sm text-ink">
              Coparticipação cobrada: <span className="font-mono font-medium">{formatCurrency(selected.coparticipation_value)}</span>
            </p>
            <p className="mt-1 text-2xs text-ink-faint">
              {selected.coparticipation_received === null && "Ainda não confirmado."}
              {selected.coparticipation_received === true &&
                `Já confirmado como recebido${selected.payment_method ? ` — ${PAYMENT_METHOD_LABELS[selected.payment_method]}` : ""}.`}
              {selected.coparticipation_received === false && "Já confirmado como NÃO recebido."}
            </p>
            {selected.coparticipation_received !== true && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <SelectField
                  label="Forma de pagamento (opcional)"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <option value="">Não informado</option>
                  {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </SelectField>
                <TextField
                  label="Parcelas (opcional)"
                  type="number"
                  min={1}
                  value={installments}
                  onChange={(e) => setInstallments(e.target.value)}
                />
              </div>
            )}
            <div className="mt-3 flex gap-2">
              <Button type="button" onClick={() => mutation.mutate(true)} disabled={mutation.isPending}>
                {mutation.isPending ? "Salvando..." : "Confirmar recebida"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => mutation.mutate(false)} disabled={mutation.isPending}>
                Confirmar NÃO recebida
              </Button>
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------
// Auditoria documental leve — OPME (Épico F2.3 do Plano Diretor:
// "Auditoria documental leve: prontuário × conta"). Versão RESTRITA
// explicitamente pedida no roadmap: "checar presença de registro de
// prescrição/evolução para procedimentos de alto valor (OPME), sem NLP
// semântico" — esta tela nunca lê nem interpreta prontuário nenhum, só
// registra que um HUMANO conferiu (ou não) que o registro existe,
// mesma mecânica de CoparticipationTab acima.
// ---------------------------------------------------------------------

function OpmeDocumentationTab() {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [selected, setSelected] = useState<BillingSearchItem | null>(null);

  const mutation = useMutation({
    mutationFn: (found: boolean) =>
      apiClient.post(`/api/v1/billing/${selected!.id}/confirm-clinical-documentation`, { found }),
    onSuccess: (_data, found) => {
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      showSuccess(found ? "Documentação clínica confirmada." : "Registrado: documentação clínica NÃO encontrada.");
      setSelected(null);
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  return (
    <Panel
      title="Conferir documentação de OPME"
      subtitle="Confirme se existe registro de prescrição/evolução no prontuário sustentando este item de órtese/prótese/material especial — antes de enviar a guia ao convênio."
    >
      <div className="p-4">
        <BillingSearchPicker selected={selected} onSelect={setSelected} />
        {selected && selected.item_type !== "material_opme" && (
          <p className="mt-3 text-2xs text-pending">Este faturamento não é um item de OPME — nada para conferir.</p>
        )}
        {selected && selected.item_type === "material_opme" && (
          <div className="mt-3 rounded-md border border-border-hairline bg-canvas-raised/40 p-3">
            <p className="text-sm text-ink">
              Item OPME cobrado: <span className="font-mono font-medium">{formatCurrency(selected.charged_value)}</span>
            </p>
            <p className="mt-1 text-2xs text-ink-faint">
              {selected.clinical_documentation_confirmed === null && "Ainda não conferido."}
              {selected.clinical_documentation_confirmed === true && "Já conferido — registro encontrado."}
              {selected.clinical_documentation_confirmed === false && "Já conferido — registro NÃO encontrado."}
            </p>
            <div className="mt-3 flex gap-2">
              <Button type="button" onClick={() => mutation.mutate(true)} disabled={mutation.isPending}>
                {mutation.isPending ? "Salvando..." : "Confirmar presente"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => mutation.mutate(false)} disabled={mutation.isPending}>
                Confirmar ausente
              </Button>
            </div>
          </div>
        )}
      </div>
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

  // Achado da Auditoria de Prontidão v1 ("busca ausente na aba de
  // Guias"): antes só havia paginação cronológica — numa clínica com
  // milhares de guias, achar uma específica exigia virar página uma a
  // uma. Filtros independentes da busca do formulário de cadastro acima.
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterPlanId, setFilterPlanId] = useState("");
  const [filterTipo, setFilterTipo] = useState("");

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(handle);
  }, [searchTerm]);

  useEffect(() => {
    setOffset(0);
  }, [debouncedSearch, filterPlanId, filterTipo]);

  const { data: plans, isLoading: plansLoading } = useQuery({
    queryKey: ["insurance-plans"],
    queryFn: () => apiClient.get<InsurancePlan[]>("/api/v1/insurance-companies/plans"),
  });

  const { data: guiasPage, isLoading, error, refetch } = useQuery({
    queryKey: ["guias", offset, debouncedSearch, filterPlanId, filterTipo],
    queryFn: () =>
      apiClient.get<PaginatedResponse<Guia>>(
        `/api/v1/guias?limit=${GUIAS_PAGE_SIZE}&offset=${offset}&search=${encodeURIComponent(debouncedSearch)}` +
          (filterPlanId ? `&insurance_plan_id=${filterPlanId}` : "") +
          (filterTipo ? `&tipo=${filterTipo}` : "")
      ),
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
        <FilterBar
          search={
            <div className="relative">
              <Search aria-hidden size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" />
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por número da guia..."
                aria-label="Buscar guia por número"
                className="w-full rounded-md border border-border-default bg-canvas-raised py-1.5 pl-8 pr-3 text-xs text-ink placeholder:text-ink-faint transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
              />
            </div>
          }
          hasActiveFilters={!!searchTerm || !!filterPlanId || !!filterTipo}
          onClear={() => {
            setSearchTerm("");
            setFilterPlanId("");
            setFilterTipo("");
          }}
        >
          <SelectField label="Convênio" value={filterPlanId} onChange={(e) => setFilterPlanId(e.target.value)}>
            <option value="">Todos</option>
            {(plans ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name}
              </option>
            ))}
          </SelectField>
          <SelectField label="Tipo" value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)}>
            <option value="">Todos</option>
            {Object.entries(GUIA_TIPO_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectField>
        </FilterBar>
        {isLoading && <LoadingState variant="table" rows={4} />}
        {error && <ErrorState message={getApiErrorMessage(error)} onRetry={() => refetch()} />}
        {!isLoading && !error && (guiasPage?.items ?? []).length === 0 && (
          <EmptyState
            icon={<FileStack size={17} strokeWidth={1.5} />}
            message={
              debouncedSearch || filterPlanId || filterTipo
                ? "Nenhuma guia encontrada com esse filtro."
                : "Nenhuma guia cadastrada ainda."
            }
          />
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
          { id: "coparticipacao", label: "Coparticipação" },
          { id: "auditoria-opme", label: "Auditoria documental (OPME)" },
          { id: "guias", label: "Guias" },
        ]}
      />

      {tab === "pagamento" && <SettlementTab />}
      {tab === "coparticipacao" && <CoparticipationTab />}
      {tab === "auditoria-opme" && <OpmeDocumentationTab />}
      {tab === "guias" && <GuiasTab />}
    </div>
  );
}
