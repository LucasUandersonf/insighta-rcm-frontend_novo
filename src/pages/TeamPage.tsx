import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarDays } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { ErrorState, LoadingState } from "@/components/ui/Panel";
import { cn } from "@/lib/cn";
import { getApiErrorMessage } from "@/lib/query-client";
import { useToast } from "@/context/ToastContext";
import { initialsFrom } from "@/lib/useCurrentUserProfile";
import { DemandStatusPill, Pill } from "@/components/team/TeamPills";
import { TeamUpdatesStrip } from "@/components/team/TeamUpdatesStrip";
import {
  ASSIGNABLE_SECTORS,
  brlWhole,
  deadlineOptions,
  dueLabel,
  firstName,
  relativeFromNow,
  shortDate,
  useDemandAction,
  useDemands,
  useTeamOverview,
  useTeamProfile,
  useTeamSectors,
  type CoordinatorScore,
  type Demand,
  type TeamSector,
} from "@/lib/team";

type TabId = "andamento" | "devolvidas" | "resolvidas";

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function listSentence(parts: string[]): string {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} e ${parts[parts.length - 1]}`;
}

function openSentence(byLabel: Record<string, number>): string {
  const parts = Object.entries(byLabel)
    .sort((a, b) => b[1] - a[1])
    .map(([label, n]) => `${n} com o ${label}`);
  return parts.length ? `${listSentence(parts)}.` : "Nenhuma demanda aberta agora.";
}

function overdueSentence(demands: Demand[]): string {
  const overdue = demands.filter((d) => d.is_overdue);
  if (overdue.length === 0) return "Nenhuma — tudo dentro do prazo.";
  const bySector = new Map<string, number>();
  overdue.forEach((d) => bySector.set(d.sector_label ?? "Outro", (bySector.get(d.sector_label ?? "Outro") ?? 0) + 1));
  if (bySector.size === 1) {
    const [label] = [...bySector.keys()];
    return overdue.length === 1 ? `No ${label}.` : overdue.length === 2 ? `As duas no ${label}.` : `Todas no ${label}.`;
  }
  return `${listSentence([...bySector.entries()].map(([label, n]) => `${n} no ${label}`))}.`;
}

function resolvedSentence(resolvedThisMonth: Demand[]): string {
  if (resolvedThisMonth.length === 0) return "Nenhuma ainda neste mês.";
  const confirmed = resolvedThisMonth.filter((d) => d.confirmation === "confirmado").length;
  const waiting = resolvedThisMonth.filter((d) => d.confirmation === "aguardando").length;
  const back = resolvedThisMonth.filter((d) => d.confirmation === "voltou").length;
  const parts = [];
  if (confirmed) parts.push(`${confirmed} já ${confirmed === 1 ? "confirmada" : "confirmadas"} pelos dados`);
  if (waiting) parts.push(`${waiting} em observação`);
  if (back) parts.push(`${back} ${back === 1 ? "voltou" : "voltaram"}`);
  return `${listSentence(parts)}.`;
}

function updateLine(d: Demand): string {
  const who = d.coordinator ? firstName(d.coordinator.full_name) : "Coordenação";
  if (d.status === "resolvido") {
    const note = d.resolution_note ? `“${d.resolution_note}”` : "Resolvida.";
    const conf =
      d.confirmation === "confirmado" ? " Confirmado pelos dados." : d.confirmation === "voltou" ? " O problema voltou nos dados." : " Em observação nos dados.";
    return `${who}: ${note}${conf}`;
  }
  if (d.last_update_note && d.last_update_at) return `${who}, ${relativeFromNow(d.last_update_at)}: “${d.last_update_note}”`;
  if (d.status === "pendente") return "Ainda não aberta pela coordenação.";
  const since = d.last_update_at ?? d.started_at ?? d.created_at;
  const days = Math.floor((Date.now() - new Date(since).getTime()) / 86400000);
  return days >= 1 ? `Sem atualização há ${plural(days, "dia", "dias")}.` : `Começou ${relativeFromNow(since)}.`;
}

function ScoreCard({ score }: { score: CoordinatorScore }) {
  const pct = score.on_time_pct;
  return (
    <article className="flex flex-col gap-4 rounded-[18px] border border-border-hairline bg-white/[0.03] p-[22px]">
      <div className="flex items-center gap-3">
        <span className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-[linear-gradient(135deg,#38BDF8,#6A57E3_55%,#A855F7)] text-[13px] font-semibold text-white">
          {initialsFrom(score.coordinator.full_name)}
        </span>
        <div className="flex flex-col gap-0.5">
          <span className="text-[15px] font-semibold text-ink">{score.coordinator.full_name}</span>
          <span className="text-xs text-ink-faint">Coordenação de {listSentence(score.sectors)}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3.5">
        <div className="flex flex-col gap-0.5">
          <span className="text-[26px] font-semibold tracking-[-0.02em] text-ink">{score.resolved_count}</span>
          <span className="text-xs text-ink-muted">resolvidas no mês</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[26px] font-semibold tracking-[-0.02em] text-[#3DD68C]">{brlWhole(score.recovered_value)}</span>
          <span className="text-xs text-ink-muted">recuperados</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[15px] font-semibold text-ink">{score.evaluated_count ? `${score.confirmed_count} de ${score.evaluated_count}` : "—"}</span>
          <span className="text-xs text-ink-muted">confirmadas pelos dados</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[15px] font-semibold text-ink">
            {score.avg_days_to_resolve === null
              ? "—"
              : `${score.avg_days_to_resolve.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ${score.avg_days_to_resolve <= 1 ? "dia" : "dias"}`}
          </span>
          <span className="text-xs text-ink-muted">tempo médio</span>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex text-xs text-ink-muted">
          <span>No prazo</span>
          <span className="ml-auto font-semibold text-ink">{pct === null ? "—" : `${Math.round(pct)}%`}</span>
        </div>
        <div className="flex h-1.5 overflow-hidden rounded-[3px] bg-white/[0.07]">
          <span className="bg-[#3DD68C]" style={{ width: `${pct ?? 0}%` }} />
        </div>
      </div>
    </article>
  );
}

function DeadlineChips({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const options = useMemo(() => deadlineOptions(), []);
  const [custom, setCustom] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = o.value === null ? custom : !custom && value === o.value;
          return (
            <button
              key={o.label}
              type="button"
              aria-pressed={on}
              onClick={() => {
                setCustom(o.value === null);
                if (o.value) onChange(o.value);
              }}
              className={cn(
                "h-[34px] rounded-full border px-3.5 text-[13px]",
                on ? "border-accent/45 bg-brand/20 text-ink" : "border-white/[0.12] text-ink-muted hover:text-ink"
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {custom && (
        <input
          type="date"
          aria-label="Data do prazo"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          className="h-10 w-48 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-[13px] text-ink"
        />
      )}
    </div>
  );
}

/** Reatribuir (troca de setor) ou Dar mais prazo (mesmo setor, novo prazo). */
function ReassignModal({ demand, mode, onClose }: { demand: Demand | null; mode: "reatribuir" | "prazo"; onClose: () => void }) {
  const { showSuccess, showError } = useToast();
  const { data: sectors } = useTeamSectors(Boolean(demand));
  const action = useDemandAction();
  const [sector, setSector] = useState<TeamSector | null>(null);
  const [due, setDue] = useState<string | null>(null);
  if (!demand) return null;
  const options = (sectors ?? []).filter((s) => ASSIGNABLE_SECTORS.includes(s.sector));
  const target = mode === "prazo" ? demand.sector : sector;
  const chosen = options.find((s) => s.sector === target);

  function submit() {
    if (!demand) return;
    action.mutate(
      { kind: "reassign", id: demand.id, sector: mode === "reatribuir" ? (sector ?? undefined) : undefined, due_date: due },
      {
        onSuccess: (d) => {
          showSuccess(mode === "prazo" ? "Prazo atualizado — a demanda voltou para a coordenação." : `Reatribuída a ${d.coordinator?.full_name ?? "coordenação"}.`);
          setSector(null);
          setDue(null);
          onClose();
        },
        onError: (err) => showError(getApiErrorMessage(err)),
      }
    );
  }

  return (
    <Modal title={mode === "prazo" ? "Dar mais prazo" : "Reatribuir"} isOpen onClose={onClose}>
      <div className="flex flex-col gap-5">
        <p className="-mt-2 text-[13px] text-ink-muted">{demand.title}</p>
        {mode === "reatribuir" && (
          <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
            <legend className="mb-2.5 text-xs font-semibold text-ink">Setor responsável</legend>
            {options.map((s) => (
              <button
                key={s.sector}
                type="button"
                aria-pressed={sector === s.sector}
                disabled={!s.coordinator}
                onClick={() => setSector(s.sector)}
                className={cn(
                  "flex w-full items-center gap-3.5 rounded-xl border px-3.5 py-3 text-left",
                  sector === s.sector ? "border-accent/50 bg-brand/[0.14]" : "border-border-hairline bg-white/[0.02]",
                  !s.coordinator && "cursor-not-allowed opacity-55"
                )}
              >
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-ink">{s.label}</span>
                  <span className={cn("text-xs", s.coordinator ? "text-ink-muted" : "text-pending")}>
                    {s.coordinator ? `Coordenação: ${s.coordinator.full_name}` : "Sem coordenador — Cadastre em Usuários e permissões"}
                  </span>
                </span>
              </button>
            ))}
          </fieldset>
        )}
        <div className="flex flex-col gap-2.5">
          <span className="text-xs font-semibold text-ink">{mode === "prazo" ? "Novo prazo" : "Prazo"}</span>
          <DeadlineChips value={due} onChange={setDue} />
        </div>
        <div className="flex justify-end gap-2.5">
          <button type="button" onClick={onClose} className="h-10 rounded-[11px] border border-white/[0.12] px-4 text-[13px] text-ink">
            Cancelar
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={action.isPending || (mode === "prazo" ? !due : !sector)}
            className="h-10 rounded-[11px] bg-brand px-[18px] text-[13px] font-medium text-white disabled:opacity-50"
          >
            {mode === "prazo" ? "Salvar prazo" : chosen?.coordinator ? `Atribuir a ${firstName(chosen.coordinator.full_name)}` : "Reatribuir"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function DemandDetailModal({ demand, canManage, onClose }: { demand: Demand | null; canManage: boolean; onClose: () => void }) {
  const action = useDemandAction();
  const { showSuccess, showError } = useToast();
  if (!demand) return null;
  const rows: [string, string | null][] = [
    ["Com quem", demand.coordinator ? `${demand.coordinator.full_name} · ${demand.sector_label}` : demand.sector_label],
    ["Prazo", dueLabel(demand.due_date)],
    ["Sua observação", demand.manager_note],
    ["Última atualização", demand.last_update_note ? `“${demand.last_update_note}”` : null],
    ["O que foi feito", demand.resolution_note ? `“${demand.resolution_note}”` : null],
  ];
  return (
    <Modal title={demand.title} isOpen onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <DemandStatusPill demand={demand} />
          {demand.financial_impact ? <span className="text-xs text-ink-faint">Impacto estimado {brlWhole(demand.financial_impact)}</span> : null}
        </div>
        <p className="text-sm leading-relaxed text-ink-soft">{demand.message}</p>
        <dl className="grid grid-cols-[140px_minmax(0,1fr)] gap-x-3 gap-y-2 text-[13px]">
          {rows
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-ink-faint">{k}</dt>
                <dd className="text-ink-soft">{v}</dd>
              </div>
            ))}
        </dl>
        {canManage && (demand.status === "pendente" || demand.status === "em_andamento") && (
          <div className="flex justify-end">
            <button
              type="button"
              disabled={action.isPending}
              onClick={() =>
                action.mutate(
                  { kind: "close", id: demand.id },
                  { onSuccess: () => (showSuccess("Demanda encerrada."), onClose()), onError: (err) => showError(getApiErrorMessage(err)) }
                )
              }
              className="h-9 rounded-[10px] border border-white/[0.12] px-3.5 text-xs text-ink"
            >
              Encerrar demanda
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}

/**
 * Canvas "Equipe" (Redesign 2026): "Você enxerga, a equipe resolve."
 * Resumo em frases, placar de metas resolvidas por coordenador e a lista
 * de demandas com Cobrar / Reatribuir / Dar mais prazo / Encerrar.
 */
export function TeamPage() {
  const { profile } = useTeamProfile();
  const canManage = profile === "gestor";
  const { showSuccess, showError } = useToast();
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as TabId | null) ?? "andamento";
  const overview = useTeamOverview();
  const demandsQuery = useDemands();
  const action = useDemandAction();
  const [detail, setDetail] = useState<Demand | null>(null);
  const [reassign, setReassign] = useState<{ demand: Demand; mode: "reatribuir" | "prazo" } | null>(null);

  const demands = demandsQuery.data ?? [];
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const open = demands.filter((d) => d.status === "pendente" || d.status === "em_andamento");
  const returned = demands.filter((d) => d.status === "devolvido");
  const resolved = demands.filter((d) => d.status === "resolvido");
  const resolvedThisMonth = resolved.filter((d) => d.resolved_at && new Date(d.resolved_at) >= monthStart);
  const month = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date());

  if (overview.isLoading || demandsQuery.isLoading) return <LoadingState rows={6} />;
  if (overview.error) return <ErrorState message={getApiErrorMessage(overview.error)} />;
  const o = overview.data!;

  const tabs: { id: TabId; label: string; count: number }[] = [
    { id: "andamento", label: "Em andamento", count: open.length },
    { id: "devolvidas", label: "Devolvidas", count: returned.length },
    { id: "resolvidas", label: "Resolvidas", count: resolved.length },
  ];
  const rows = tab === "resolvidas" ? resolved : tab === "andamento" ? open : [];

  function nudge(d: Demand) {
    action.mutate(
      { kind: "nudge", id: d.id },
      {
        onSuccess: () => showSuccess(`${d.coordinator?.full_name ?? "A coordenação"} foi cobrada — a demanda sobe para o topo da Home.`),
        onError: (err) => showError(getApiErrorMessage(err)),
      }
    );
  }

  function close(d: Demand) {
    action.mutate({ kind: "close", id: d.id }, { onSuccess: () => showSuccess("Demanda encerrada."), onError: (err) => showError(getApiErrorMessage(err)) });
  }

  return (
    <div className="flex flex-col gap-7 pb-12">
      <div className="-mt-8">
        <TeamUpdatesStrip updates={o.updates} canAcknowledge={canManage} />
      </div>

      <div className="flex flex-wrap items-end gap-4 pt-2">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[34px] font-semibold tracking-[-0.02em] text-ink">Equipe</h1>
          <p className="text-sm text-ink-muted">Você enxerga, a equipe resolve. Acompanhe cada demanda até a confirmação nos dados.</p>
        </div>
        <span className="ml-auto flex h-[38px] items-center gap-2 rounded-[11px] border border-white/10 bg-white/[0.04] px-3.5 text-[13px] text-ink">
          <CalendarDays aria-hidden size={14} className="text-ink-muted" />
          Este mês
        </span>
      </div>

      <section aria-label="Resumo da equipe" className="grid overflow-hidden rounded-[20px] border border-border-hairline bg-white/[0.025] sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Em aberto", value: String(o.open_count), tone: "", text: openSentence(o.open_by_sector) },
          { label: "Atrasadas", value: String(o.overdue_count), tone: o.overdue_count ? "text-[#FF8A8A]" : "", text: overdueSentence(open) },
          { label: "Resolvidas no mês", value: String(o.resolved_month), tone: "", text: resolvedSentence(resolvedThisMonth) },
          {
            label: "Recuperado pela equipe",
            value: brlWhole(o.recovered_month),
            tone: "text-[#3DD68C]",
            text: "Soma do impacto das demandas resolvidas no mês — as que voltaram não contam.",
          },
        ].map((c) => (
          <div key={c.label} className="flex flex-col gap-2 border-b border-r border-border-hairline px-6 py-5 last:border-r-0">
            <span className="text-[13px] text-ink-muted">{c.label}</span>
            <span className={cn("text-[30px] font-semibold text-ink", c.tone)}>{c.value}</span>
            <span className="text-[13px] text-ink-soft">{c.text}</span>
          </div>
        ))}
      </section>

      <section aria-labelledby="placar" className="flex flex-col gap-3.5">
        <div className="flex items-baseline gap-2.5">
          <h2 id="placar" className="text-lg font-semibold text-ink">
            Metas resolvidas por coordenador
          </h2>
          <span className="text-xs text-ink-faint">{month}</span>
        </div>
        {o.scoreboard.length === 0 ? (
          <p className="text-sm text-ink-muted">Nenhum setor tem coordenador ainda — cadastre em Usuários e permissões para começar a atribuir.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {o.scoreboard.map((s) => (
              <ScoreCard key={s.coordinator.id} score={s} />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="demandas" className="flex flex-col gap-3.5 rounded-[20px] border border-border-hairline bg-white/[0.03] p-6">
        <div className="flex flex-wrap items-center gap-x-[22px] border-b border-border-hairline">
          <h2 id="demandas" className="mb-3 text-base font-semibold text-ink">
            Demandas
          </h2>
          <div role="tablist" aria-label="Demandas por status" className="flex flex-wrap gap-x-[22px]">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setParams({ tab: t.id }, { replace: true })}
              className={cn("-mb-px pb-3 text-[13px]", tab === t.id ? "border-b-2 border-accent-muted font-medium text-ink" : "text-ink-faint hover:text-ink")}
            >
              {t.label} ({t.count})
            </button>
          ))}
          </div>
        </div>

        {tab !== "devolvidas" && (
          <>
            {rows.length === 0 ? (
              <p className="px-3.5 py-6 text-sm text-ink-muted">
                {tab === "andamento" ? "Nenhuma demanda em andamento. Atribua pelo botão “Atribuir” em qualquer insight." : "Nenhuma demanda resolvida ainda."}
              </p>
            ) : (
              <>
                <div className="hidden grid-cols-[120px_minmax(0,1fr)_200px_130px_90px] gap-4 px-3.5 text-xs text-ink-faint md:grid">
                  <span>Status</span>
                  <span>Demanda</span>
                  <span>Com quem</span>
                  <span>{tab === "resolvidas" ? "Resolvida em" : "Prazo"}</span>
                  <span />
                </div>
                {rows.map((d) => (
                  <div
                    key={d.id}
                    className="grid items-center gap-2 rounded-[14px] bg-white/[0.025] p-3.5 md:grid-cols-[120px_minmax(0,1fr)_200px_130px_90px] md:gap-4"
                  >
                    <span>
                      <DemandStatusPill demand={d} />
                    </span>
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="text-sm font-medium text-ink">{d.title}</span>
                      <span className="text-xs text-ink-muted">{updateLine(d)}</span>
                    </div>
                    <span className="text-[13px] text-ink-soft">
                      {d.coordinator?.full_name ?? "—"} · {d.sector_label}
                    </span>
                    <span className={cn("text-[13px]", d.is_overdue ? "text-[#FF8A8A]" : "text-ink-soft")}>
                      {tab === "resolvidas" && d.resolved_at ? shortDate(d.resolved_at) : dueLabel(d.due_date)}
                    </span>
                    <span className="md:justify-self-end">
                      {d.is_overdue && canManage ? (
                        <button
                          type="button"
                          disabled={action.isPending}
                          onClick={() => nudge(d)}
                          className="h-[34px] rounded-[10px] border border-[rgba(242,107,107,0.35)] bg-[rgba(242,107,107,0.12)] px-3.5 text-xs font-medium text-[#FF8A8A]"
                        >
                          {d.nudged_at ? "Cobrar de novo" : "Cobrar"}
                        </button>
                      ) : (
                        <button type="button" onClick={() => setDetail(d)} className="h-[34px] rounded-[10px] border border-white/[0.12] px-3.5 text-xs text-ink">
                          Ver
                        </button>
                      )}
                    </span>
                  </div>
                ))}
              </>
            )}
          </>
        )}

        {(tab === "devolvidas" || tab === "andamento") &&
          returned.map((d) => (
            <div key={d.id} className="flex flex-col gap-3 rounded-[14px] border border-[rgba(139,124,246,0.28)] bg-[rgba(139,124,246,0.07)] p-4">
              <div className="flex flex-wrap items-center gap-3">
                <Pill tone="violet">Devolvida</Pill>
                <span className="text-sm font-medium text-ink">{d.title}</span>
                <span className="ml-auto text-xs text-ink-faint">
                  {d.coordinator?.full_name} · {d.sector_label}
                  {d.returned_at ? ` · ${relativeFromNow(d.returned_at)}` : ""}
                </span>
              </div>
              <p className="text-[13px] leading-relaxed text-ink-soft">
                <span className="font-semibold text-[#D6CFFF]">{d.returned_reason_label}:</span> “{d.returned_note}”
              </p>
              {canManage && (
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setReassign({ demand: d, mode: "reatribuir" })} className="h-[34px] rounded-[10px] bg-brand px-3.5 text-xs font-medium text-white">
                    Reatribuir
                  </button>
                  <button type="button" onClick={() => setReassign({ demand: d, mode: "prazo" })} className="h-[34px] rounded-[10px] border border-white/[0.12] px-3.5 text-xs text-ink">
                    Dar mais prazo
                  </button>
                  <button type="button" disabled={action.isPending} onClick={() => close(d)} className="h-[34px] rounded-[10px] border border-white/[0.12] px-3.5 text-xs text-ink">
                    Encerrar
                  </button>
                </div>
              )}
            </div>
          ))}
        {tab === "devolvidas" && returned.length === 0 && <p className="px-3.5 py-6 text-sm text-ink-muted">Nenhuma demanda devolvida.</p>}
      </section>

      <DemandDetailModal demand={detail} canManage={canManage} onClose={() => setDetail(null)} />
      {reassign && <ReassignModal demand={reassign.demand} mode={reassign.mode} onClose={() => setReassign(null)} />}
    </div>
  );
}
