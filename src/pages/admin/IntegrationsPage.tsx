import { useState, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plug, Plus, Webhook } from "lucide-react";
import { Panel, EmptyState, LoadingState, ErrorState } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TextField } from "@/components/ui/FormField";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { useToast } from "@/context/ToastContext";
import type {
  ApiKey,
  ApiKeyCreated,
  WebhookDeliveryEntry,
  WebhookDeliveryStatus,
  WebhookSubscription,
  WebhookSubscriptionCreated,
} from "@/lib/types";

const DELIVERY_STATUS_LABEL: Record<WebhookDeliveryStatus, string> = {
  pending: "Aguardando retentativa",
  delivered: "Entregue",
  failed: "Desistido",
};

const DELIVERY_STATUS_TONE: Record<WebhookDeliveryStatus, BadgeTone> = {
  pending: "pending",
  delivered: "revenue",
  failed: "denied",
};

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
}

/** A chave em texto puro só aparece nesta janela, uma única vez — mesma
 * lógica de TemporaryPasswordModal em UsersPage.tsx (o backend nunca a
 * persiste em texto puro nem a reexibe depois). */
function CreatedKeyModal({ created, onClose }: { created: ApiKeyCreated | null; onClose: () => void }) {
  return (
    <Modal title="Chave de API criada" isOpen={created !== null} onClose={onClose}>
      <p className="mb-3 text-sm text-ink-muted">
        Copie e configure no ERP do cliente agora — esta chave não pode ser recuperada novamente depois de fechar esta janela.
      </p>
      <div className="break-all rounded-md border border-border-default bg-canvas-raised px-3 py-2.5 font-mono text-sm text-ink">{created?.api_key}</div>
      <div className="mt-5 flex justify-end">
        <Button onClick={onClose}>Entendi, já copiei</Button>
      </div>
    </Modal>
  );
}

function CreateKeyModal({ isOpen, onClose, onCreated }: { isOpen: boolean; onClose: () => void; onCreated: (key: ApiKeyCreated) => void }) {
  const queryClient = useQueryClient();
  const { showError } = useToast();
  const [name, setName] = useState("");

  const mutation = useMutation({
    mutationFn: () => apiClient.post<ApiKeyCreated>("/api/v1/integrations/api-keys", { name }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      setName("");
      onClose();
      onCreated(created);
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  return (
    <Modal title="Nova chave de API" isOpen={isOpen} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <TextField
          label="Nome da chave"
          placeholder="Ex: ERP TotalCare — produção"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Gerando..." : "Gerar chave"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** O segredo de assinatura só aparece nesta janela, uma única vez — mesma
 * lógica de CreatedKeyModal acima (o backend nunca o reexibe depois da
 * criação). Diferente da API key, este segredo o cliente cola na
 * configuração de verificação do PRÓPRIO lado (Zapier/Make, ou o código
 * que recebe o webhook), não em campo nenhum desta tela. */
function CreatedWebhookModal({ created, onClose }: { created: WebhookSubscriptionCreated | null; onClose: () => void }) {
  return (
    <Modal title="Webhook cadastrado" isOpen={created !== null} onClose={onClose}>
      <p className="mb-3 text-sm text-ink-muted">
        Use este segredo para verificar a assinatura HMAC (<code>X-Insighta-Signature</code>) de cada entrega — ele não pode ser
        recuperado novamente depois de fechar esta janela.
      </p>
      <div className="break-all rounded-md border border-border-default bg-canvas-raised px-3 py-2.5 font-mono text-sm text-ink">{created?.secret}</div>
      <div className="mt-5 flex justify-end">
        <Button onClick={onClose}>Entendi, já copiei</Button>
      </div>
    </Modal>
  );
}

function CreateWebhookModal({
  isOpen,
  onClose,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (webhook: WebhookSubscriptionCreated) => void;
}) {
  const queryClient = useQueryClient();
  const { showError } = useToast();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [eventTypes, setEventTypes] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      apiClient.post<WebhookSubscriptionCreated>("/api/v1/integrations/webhooks", {
        name,
        url,
        // Campo vazio = recebe todos os eventos (ver DECISÃO em
        // app/schemas/webhook_subscription.py) — mesma convenção de "sem
        // restrição" já usada em Gestão de Contatos para Relatórios.
        event_types: eventTypes
          .split(",")
          .map((e) => e.trim())
          .filter(Boolean),
        active: true,
      }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["webhook-subscriptions"] });
      setName("");
      setUrl("");
      setEventTypes("");
      onClose();
      onCreated(created);
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  return (
    <Modal title="Novo webhook" isOpen={isOpen} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <TextField label="Nome" placeholder="Ex: Slack — financeiro" required value={name} onChange={(e) => setName(e.target.value)} />
        <TextField
          label="URL (HTTPS)"
          placeholder="https://hooks.slack.com/services/..."
          type="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <TextField
          label="Eventos (opcional)"
          placeholder="billing.held_for_review, denial_appeal.resolved — vazio recebe todos"
          value={eventTypes}
          onChange={(e) => setEventTypes(e.target.value)}
        />
        <p className="mb-4 text-2xs text-ink-faint">
          Separe vários por vírgula. Disponíveis hoje: <code className="font-mono">billing.held_for_review</code> (faturamento
          retido por risco de glosa), <code className="font-mono">denial_appeal.resolved</code> (recurso de glosa
          deferido/indeferido/escalado para NIP) e <code className="font-mono">no_show_risk.high</code> (agendamento com alto
          risco de falta).
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Cadastrando..." : "Cadastrar webhook"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function WebhooksSection() {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [createdWebhook, setCreatedWebhook] = useState<WebhookSubscriptionCreated | null>(null);

  const { data: webhooks, isLoading, error } = useQuery({
    queryKey: ["webhook-subscriptions"],
    queryFn: () => apiClient.get<WebhookSubscription[]>("/api/v1/integrations/webhooks"),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      apiClient.patch<WebhookSubscription>(`/api/v1/integrations/webhooks/${id}`, { active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["webhook-subscriptions"] }),
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete<void>(`/api/v1/integrations/webhooks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhook-subscriptions"] });
      showSuccess("Webhook removido.");
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  return (
    <Panel
      title="Webhooks"
      subtitle="Avise o Slack, o CRM ou a planilha do cliente quando algo relevante acontecer — sem ele precisar ficar olhando o painel."
      action={
        <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-1.5">
          <Plus size={14} />
          Novo webhook
        </Button>
      }
    >
      {isLoading && <LoadingState />}
      {error && <ErrorState message={getApiErrorMessage(error)} />}
      {!isLoading && !error && (webhooks ?? []).length === 0 && (
        <EmptyState icon={<Webhook size={17} strokeWidth={1.5} />} message="Nenhum webhook cadastrado ainda. Clique em “Novo webhook” para avisar um sistema externo." />
      )}
      {!isLoading && (webhooks ?? []).length > 0 && (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border-hairline text-2xs uppercase tracking-wide text-ink-faint">
              <th className="px-4 py-2.5 font-medium">Nome</th>
              <th className="px-4 py-2.5 font-medium">URL</th>
              <th className="px-4 py-2.5 font-medium">Eventos</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {(webhooks ?? []).map((w) => (
              <tr key={w.id} className="border-b border-border-hairline last:border-0 transition-colors hover:bg-canvas-raised/60">
                <td className="px-4 py-2.5 text-ink">{w.name}</td>
                <td className="max-w-xs truncate px-4 py-2.5 font-mono text-ink-muted" title={w.url}>{w.url}</td>
                <td className="px-4 py-2.5 text-ink-muted">{w.event_types.length > 0 ? w.event_types.join(", ") : "Todos"}</td>
                <td className="px-4 py-2.5">
                  <Badge tone={w.active ? "revenue" : "neutral"}>{w.active ? "Ativo" : "Inativo"}</Badge>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="xs"
                      disabled={toggleMutation.isPending}
                      onClick={() => toggleMutation.mutate({ id: w.id, active: !w.active })}
                    >
                      {w.active ? "Desativar" : "Ativar"}
                    </Button>
                    <Button variant="ghost" size="xs" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(w.id)}>
                      Excluir
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <CreateWebhookModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onCreated={setCreatedWebhook} />
      <CreatedWebhookModal created={createdWebhook} onClose={() => setCreatedWebhook(null)} />
    </Panel>
  );
}

/** Visibilidade da fila de retentativa (ver app/sql/028_webhook_delivery_queue.sql
 * no backend) — "por que meu Slack não recebeu aquele aviso?" sem
 * precisar abrir um chamado de suporte. Só leitura: reenviar antes da
 * hora não existe nesta v1, o worker já cobre isso automaticamente. */
function WebhookDeliveriesSection() {
  const { data: deliveries, isLoading, error } = useQuery({
    queryKey: ["webhook-deliveries"],
    queryFn: () => apiClient.get<WebhookDeliveryEntry[]>("/api/v1/integrations/webhooks/deliveries"),
    // Refetch periódico bem mais lento que o intervalo de retentativa
    // (mínimo 1 min) — só para a tela não parecer "parada" se alguém
    // deixar aberta enquanto o worker processa a fila em segundo plano.
    refetchInterval: 60_000,
  });

  const rows = deliveries ?? [];
  if (!isLoading && !error && rows.length === 0) return null; // nada a mostrar ainda — não polui a tela com um painel vazio

  return (
    <Panel title="Entregas recentes" subtitle="As 50 tentativas mais recentes de envio de webhook, pendentes e já resolvidas.">
      {isLoading && <LoadingState />}
      {error && <ErrorState message={getApiErrorMessage(error)} />}
      {!isLoading && rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border-hairline text-2xs uppercase tracking-wide text-ink-faint">
                <th className="px-4 py-2.5 font-medium">Evento</th>
                <th className="px-4 py-2.5 font-medium">Tentativas</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Próxima tentativa / erro</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id} className="border-b border-border-hairline last:border-0 transition-colors hover:bg-canvas-raised/60">
                  <td className="px-4 py-2.5 font-mono text-ink-muted">{d.event_type}</td>
                  <td className="tabular px-4 py-2.5 text-ink-muted">{d.attempt_count}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone={DELIVERY_STATUS_TONE[d.status]}>{DELIVERY_STATUS_LABEL[d.status]}</Badge>
                  </td>
                  <td className="max-w-xs truncate px-4 py-2.5 text-ink-muted" title={d.last_error ?? undefined}>
                    {d.status === "pending" ? formatDateTime(d.next_attempt_at) : d.last_error ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

export function IntegrationsPage() {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [createdKey, setCreatedKey] = useState<ApiKeyCreated | null>(null);

  const { data: keys, isLoading, error } = useQuery({
    queryKey: ["api-keys"],
    queryFn: () => apiClient.get<ApiKey[]>("/api/v1/integrations/api-keys"),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete<ApiKey>(`/api/v1/integrations/api-keys/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      showSuccess("Chave revogada.");
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Plug}
        title="Integrações e webhooks"
        subtitle="Conecte o ecossistema do cliente: chave de API para ele ENVIAR dado ao Insighta, webhooks para o Insighta AVISAR o sistema dele."
      />

      <Panel
        title="Chaves de API"
        subtitle="Configure no ERP/CRM do cliente — a chave em texto puro só aparece uma vez, na criação."
        action={
          <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-1.5">
            <Plus size={14} />
            Nova chave
          </Button>
        }
      >
        {isLoading && <LoadingState />}
        {error && <ErrorState message={getApiErrorMessage(error)} />}
        {!isLoading && !error && (keys ?? []).length === 0 && (
          <EmptyState icon={<Plug size={17} strokeWidth={1.5} />} message="Nenhuma chave de API gerada ainda. Clique em “Nova chave” para conectar o ERP do cliente." />
        )}
        {!isLoading && (keys ?? []).length > 0 && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border-hairline text-2xs uppercase tracking-wide text-ink-faint">
                <th className="px-4 py-2.5 font-medium">Nome</th>
                <th className="px-4 py-2.5 font-medium">Prefixo</th>
                <th className="px-4 py-2.5 font-medium">Criada em</th>
                <th className="px-4 py-2.5 font-medium">Último uso</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {(keys ?? []).map((k) => (
                <tr key={k.id} className="border-b border-border-hairline last:border-0 transition-colors hover:bg-canvas-raised/60">
                  <td className="px-4 py-2.5 text-ink">{k.name}</td>
                  <td className="tabular px-4 py-2.5 font-mono text-ink-muted">{k.key_prefix}…</td>
                  <td className="tabular px-4 py-2.5 font-mono text-ink-muted">{formatDateTime(k.created_at)}</td>
                  <td className="tabular px-4 py-2.5 font-mono text-ink-muted">{formatDateTime(k.last_used_at)}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone={k.revoked_at ? "neutral" : "revenue"}>{k.revoked_at ? "Revogada" : "Ativa"}</Badge>
                  </td>
                  <td className="px-4 py-2.5">
                    {!k.revoked_at && (
                      <Button variant="ghost" size="xs" disabled={revokeMutation.isPending} onClick={() => revokeMutation.mutate(k.id)}>
                        Revogar
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <CreateKeyModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onCreated={setCreatedKey} />
      <CreatedKeyModal created={createdKey} onClose={() => setCreatedKey(null)} />

      <WebhooksSection />
      <WebhookDeliveriesSection />
    </div>
  );
}
