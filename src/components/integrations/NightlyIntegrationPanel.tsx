import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Download, FileText, Moon } from "lucide-react";
import { Panel, LoadingState, ErrorState } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { apiClient } from "@/lib/api-client";
import { saveBlob } from "@/lib/download";
import { getApiErrorMessage } from "@/lib/query-client";
import { useToast } from "@/context/ToastContext";
import type { IntegrationDataType, IntegrationFeedState, IntegrationStatus } from "@/lib/types";

export const INTEGRATION_STATUS_KEY = ["integration-status"] as const;

const STATE_TONE: Record<IntegrationFeedState, BadgeTone> = {
  ok: "revenue",
  aguardando: "neutral",
  nao_chegou: "denied",
  volume_baixo: "pending",
  muitas_recusas: "pending",
  conector_erro: "denied",
  nao_esperada: "neutral",
};

const ALERT_KIND_LABEL: Record<string, string> = {
  nao_chegou: "Não chegou",
  volume_baixo: "Volume baixo",
  muitas_recusas: "Muitas recusas",
  conector_erro: "Erro no conector",
};

const FEED_LABEL: Record<IntegrationDataType, string> = {
  faturamento: "Faturamento",
  agenda: "Agenda",
  atendimento: "Atendimento",
  estoque: "Estoque",
  pep: "Prontuário",
};

const HOURS = Array.from({ length: 23 }, (_, i) => i + 1);

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
}

function formatInt(n: number | null | undefined): string {
  return n == null ? "—" : n.toLocaleString("pt-BR");
}

/**
 * Integração noturna: o ERP envia sozinho, toda madrugada, pelas views com as
 * colunas dos modelos de importação e o Conector Insighta. Aqui a clínica
 * escolhe as pernas que espera receber e a hora do alarme, e acompanha a
 * última carga de cada perna e a última execução do conector.
 */
export function NightlyIntegrationPanel() {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const { data, isLoading, error } = useQuery({
    queryKey: INTEGRATION_STATUS_KEY,
    queryFn: () => apiClient.get<IntegrationStatus>("/api/v1/integrations/status"),
    refetchInterval: 60_000,
  });

  const [expected, setExpected] = useState<IntegrationDataType[]>([]);
  const [alertHour, setAlertHour] = useState(6);
  useEffect(() => {
    if (data) {
      setExpected(data.expected_types);
      setAlertHour(data.alert_hour);
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      apiClient.put<IntegrationStatus>("/api/v1/integrations/settings", { expected_types: expected, alert_hour: alertHour }),
    onSuccess: (status) => {
      queryClient.setQueryData(INTEGRATION_STATUS_KEY, status);
      showSuccess("Configuração da integração salva.");
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  const dirty =
    !!data &&
    (alertHour !== data.alert_hour ||
      expected.length !== data.expected_types.length ||
      expected.some((t) => !data.expected_types.includes(t)));

  function toggle(type: IntegrationDataType) {
    setExpected((current) => (current.includes(type) ? current.filter((t) => t !== type) : [...current, type]));
  }

  const run = data?.last_connector_run ?? null;

  return (
    <Panel
      title="Integração noturna com o ERP"
      subtitle="O ERP envia os dados sozinho toda madrugada. A equipe do ERP cria uma view por perna com as mesmas colunas dos modelos de importação, e o Conector Insighta envia à meia-noite."
      help="A planilha continua funcionando. O status e o alarme olham só o que chega pela integração (conector ou API)."
      action={
        <Button
          variant="secondary"
          size="sm"
          className="flex items-center gap-1.5"
          onClick={() =>
            saveBlob("/api/v1/integrations/connector/download", "insighta-conector.zip").catch((err) => showError(getApiErrorMessage(err)))
          }
        >
          <Download aria-hidden size={14} /> Baixar conector
        </Button>
      }
    >
      {isLoading && <LoadingState />}
      {error && <ErrorState message={getApiErrorMessage(error)} />}
      {data && (
        <div className="space-y-6">
          {data.active_api_keys === 0 && (
            <div className="rounded-lg border border-pending/30 bg-pending-bg px-4 py-3 text-sm text-ink">
              <p className="font-medium">Para começar</p>
              <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-ink-muted">
                <li>A equipe do ERP cria as views com as colunas dos modelos (Importar dados → Baixar modelo).</li>
                <li>Crie uma chave de API chamada “Conector” logo abaixo.</li>
                <li>Baixe o conector, configure com a chave e agende à meia-noite (instruções no pacote).</li>
                <li>Marque aqui as pernas que vão chegar toda noite.</li>
              </ol>
            </div>
          )}

          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Situação de cada perna">
            {data.feeds.map((feed) => (
              <li
                key={feed.data_type}
                className={
                  "flex flex-col gap-2 rounded-lg border px-4 py-3 " +
                  (feed.alarm ? "border-denied/40 bg-denied-bg/40" : "border-border-hairline bg-canvas-raised/40")
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-ink">{feed.label}</span>
                  <Badge tone={STATE_TONE[feed.state]}>{feed.state_label}</Badge>
                </div>
                <p className="text-xs text-ink-muted">{feed.detail}</p>
                {feed.expected && (
                  <dl className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <dt className="text-ink-faint">Hoje</dt>
                      <dd className="tabular font-medium text-ink">{formatInt(feed.rows_today)}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-faint">Recusadas</dt>
                      <dd className={"tabular font-medium " + (feed.rejected_today ? "text-denied" : "text-ink")}>
                        {formatInt(feed.rejected_today)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-ink-faint">Normal</dt>
                      <dd className="tabular font-medium text-ink">{formatInt(feed.typical_rows)}</dd>
                    </div>
                  </dl>
                )}
                <p className="text-2xs text-ink-faint">
                  Última carga automática: {formatDateTime(feed.last_automatic_at)}
                  {feed.last_automatic_rows != null && ` · ${formatInt(feed.last_automatic_rows)} linhas`}
                </p>
              </li>
            ))}
          </ul>

          <div className="grid gap-6 lg:grid-cols-2">
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate();
              }}
            >
              <h3 className="text-sm font-semibold text-ink">O que deve chegar toda noite</h3>
              <fieldset className="flex flex-wrap gap-2">
                <legend className="sr-only">Pernas esperadas</legend>
                {(Object.keys(FEED_LABEL) as IntegrationDataType[]).map((type) => (
                  <label
                    key={type}
                    className="flex cursor-pointer items-center gap-2 rounded-md border border-border-default px-3 py-1.5 text-sm text-ink hover:bg-canvas-raised"
                  >
                    <input type="checkbox" checked={expected.includes(type)} onChange={() => toggle(type)} />
                    {FEED_LABEL[type]}
                  </label>
                ))}
              </fieldset>
              <label className="flex items-center gap-2 text-sm text-ink">
                Avisar se a carga não chegar até
                <select
                  className="rounded-md border border-border-default bg-canvas px-2 py-1 text-sm"
                  value={alertHour}
                  onChange={(e) => setAlertHour(Number(e.target.value))}
                  aria-label="Hora do alarme"
                >
                  {HOURS.map((h) => (
                    <option key={h} value={h}>
                      {String(h).padStart(2, "0")}h
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-2xs text-ink-faint">
                O alarme também dispara se a carga vier com muito menos linhas que o normal ou com muitas linhas recusadas.
                Avisamos os donos e administradores por e-mail, e a equipe Insighta também recebe.
              </p>
              <Button type="submit" size="sm" disabled={!dirty || save.isPending}>
                {save.isPending ? "Salvando…" : "Salvar"}
              </Button>
            </form>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-ink">Última execução do conector</h3>
              {run ? (
                <div className="space-y-2 text-sm">
                  <p className="flex items-center gap-2 text-ink">
                    {run.ok ? (
                      <CheckCircle2 aria-hidden size={15} className="text-revenue" />
                    ) : (
                      <Moon aria-hidden size={15} className="text-denied" />
                    )}
                    {run.ok ? "Concluída sem erro" : "Concluída com erro"} em {formatDateTime(run.finished_at ?? run.received_at)}
                  </p>
                  <p className="text-xs text-ink-muted">
                    Versão {run.connector_version ?? "—"}
                    {run.host ? ` · servidor ${run.host}` : ""}
                  </p>
                  <ul className="space-y-1 text-xs">
                    {run.results.map((r) => (
                      <li key={r.data_type} className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-medium text-ink">{FEED_LABEL[r.data_type] ?? r.data_type}:</span>
                        {r.status === "ok" ? (
                          <span className="text-ink-muted">
                            {formatInt(r.rows_read)} lidas, {formatInt(r.rows_accepted)} aceitas, {formatInt(r.rows_rejected)} recusadas
                          </span>
                        ) : (
                          <span className="text-denied">{r.message ?? "erro"}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-ink-muted">O conector ainda não rodou para esta clínica.</p>
              )}
              <p className="flex items-center gap-1.5 text-2xs text-ink-faint">
                <FileText aria-hidden size={12} /> O guia para a equipe do ERP e o passo a passo de instalação estão no pacote do conector.
              </p>
            </div>
          </div>

          {data.recent_alerts.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-ink">Alarmes dos últimos 14 dias</h3>
              <ul className="divide-y divide-border-hairline text-xs">
                {data.recent_alerts.map((a) => (
                  <li key={`${a.data_type}-${a.kind}-${a.alert_date}`} className="flex flex-wrap gap-x-3 py-1.5">
                    <span className="tabular text-ink-faint">{formatDateTime(a.created_at)}</span>
                    <span className="font-medium text-ink">
                      {FEED_LABEL[a.data_type as IntegrationDataType] ?? a.data_type} · {ALERT_KIND_LABEL[a.kind] ?? a.kind}
                    </span>
                    <span className="text-ink-muted">{a.detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}
