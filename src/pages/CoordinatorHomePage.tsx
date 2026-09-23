import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { LoadingState } from "@/components/ui/Panel";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { getApiErrorMessage } from "@/lib/query-client";
import { firstNameFrom, useCurrentUserProfile } from "@/lib/useCurrentUserProfile";
import { useToast } from "@/context/ToastContext";
import { Pill } from "@/components/team/TeamPills";
import {
  RETURN_REASONS,
  brlWhole,
  dueLabel,
  relativeFromNow,
  shortDate,
  useCoordinatorSummary,
  useDemandAction,
  useDemands,
  type Demand,
  type ReturnReason,
} from "@/lib/team";
import type { TodayAgenda } from "@/lib/types";

function greeting(now = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function isDueToday(d: Demand): boolean {
  if (!d.due_date) return false;
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return d.due_date === today;
}

function assignedLine(d: Demand): string {
  const when = new Date(d.created_at);
  const isToday = when.toDateString() === new Date().toDateString();
  const at = isToday ? `hoje, ${when.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : relativeFromNow(d.created_at);
  return `Atribuída por ${d.assigned_by?.full_name ?? "gestão"} · ${at}`;
}

type Mode = "idle" | "resolving" | "returning" | "updating";

/** Card de demanda aberta (canvas "Coordenador"): Começar → Marcar como
 * resolvida ("O que foi feito?") ou Devolver (motivo + explicação). */
function OpenDemandCard({ demand }: { demand: Demand }) {
  const action = useDemandAction();
  const { showSuccess, showError } = useToast();
  const [mode, setMode] = useState<Mode>("idle");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState<ReturnReason>("outro_setor");
  const [done, setDone] = useState<{ tone: "green" | "violet"; text: string } | null>(null);
  const manager = demand.assigned_by?.full_name ? firstNameFrom(demand.assigned_by.full_name) : "a gestão";
  const dueToday = isDueToday(demand);
  const urgent = demand.is_overdue || dueToday;

  function run(kind: "start" | "resolve" | "return" | "update") {
    const payload =
      kind === "start"
        ? { kind, id: demand.id }
        : kind === "return"
          ? { kind, id: demand.id, reason, note: note.trim() }
          : { kind, id: demand.id, note: note.trim() };
    action.mutate(payload as Parameters<typeof action.mutate>[0], {
      onSuccess: () => {
        if (kind === "resolve")
          setDone({ tone: "green", text: "Resolvida. A gestão já recebeu o aviso na Home — o Insighta confere nos dados nos próximos dias." });
        else if (kind === "return")
          setDone({
            tone: "violet",
            text: `Devolvida para ${manager} com o motivo “${RETURN_REASONS.find((r) => r.id === reason)?.label}”. A gestão decide se reatribui, dá mais prazo ou encerra.`,
          });
        else if (kind === "update") showSuccess("Atualização enviada para a gestão.");
        setMode("idle");
        setNote("");
      },
      onError: (err) => showError(getApiErrorMessage(err)),
    });
  }

  return (
    <article
      className={cn(
        "flex flex-col gap-3.5 rounded-[20px] border p-6",
        urgent
          ? "border-[rgba(242,107,107,0.28)] bg-[linear-gradient(160deg,rgba(242,107,107,0.10),rgba(242,107,107,0.02)_60%)]"
          : demand.status === "em_andamento"
            ? "border-[rgba(240,180,76,0.25)] bg-white/[0.03]"
            : "border-border-hairline bg-white/[0.03]"
      )}
    >
      <div className="flex flex-wrap items-center gap-2.5">
        {demand.status === "pendente" ? <Pill tone="blue">Nova</Pill> : <Pill tone="amber">Em andamento</Pill>}
        {demand.is_overdue ? (
          <Pill tone="red">Atrasada</Pill>
        ) : dueToday ? (
          <Pill tone="red">Vence hoje</Pill>
        ) : demand.due_date ? (
          <span className="text-xs text-ink-muted">Prazo: {dueLabel(demand.due_date).toLowerCase()}</span>
        ) : null}
        {demand.nudged_at && <Pill tone="red">Cobrada pela gestão</Pill>}
        <span className="ml-auto text-xs text-ink-faint">{assignedLine(demand)}</span>
      </div>
      <h3 className="font-serif text-[24px] font-medium leading-[1.3] text-ink">{demand.title}</h3>
      <p className="text-sm leading-relaxed text-ink-soft">{demand.message}</p>
      {demand.manager_note && (
        <div className="rounded-xl border border-white/[0.06] bg-[rgba(11,12,18,0.5)] px-3.5 py-3 text-[13px] leading-relaxed text-ink-soft">
          <span className="font-semibold text-ink">Observação da gestão:</span> “{demand.manager_note}”
        </div>
      )}

      {done ? (
        <div
          role="status"
          className={cn(
            "rounded-[14px] border px-4 py-3.5 text-[13px] leading-relaxed",
            done.tone === "green"
              ? "border-[rgba(61,214,140,0.3)] bg-[rgba(61,214,140,0.08)] text-[#3DD68C]"
              : "border-[rgba(139,124,246,0.3)] bg-[rgba(139,124,246,0.08)] text-[#D6CFFF]"
          )}
        >
          {done.text}
        </div>
      ) : mode === "idle" ? (
        <div className="flex flex-wrap items-center gap-2.5">
          {demand.status === "pendente" ? (
            <button type="button" disabled={action.isPending} onClick={() => run("start")} className="h-10 rounded-[11px] bg-brand px-4 text-[13px] font-medium text-white">
              Começar
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setMode("resolving")}
                className="h-10 rounded-[11px] border border-[rgba(61,214,140,0.4)] bg-[rgba(61,214,140,0.14)] px-4 text-[13px] font-medium text-[#3DD68C]"
              >
                Marcar como resolvida
              </button>
              <button type="button" onClick={() => setMode("updating")} className="h-10 rounded-[11px] border border-white/[0.12] px-4 text-[13px] text-ink">
                Registrar andamento
              </button>
            </>
          )}
          <button type="button" onClick={() => setMode("returning")} className="h-10 rounded-[11px] border border-white/[0.12] px-4 text-[13px] text-ink">
            Devolver
          </button>
          {demand.financial_impact ? <span className="ml-auto text-xs text-ink-faint">Impacto estimado {brlWhole(demand.financial_impact)}</span> : null}
        </div>
      ) : mode === "resolving" || mode === "updating" ? (
        <div
          className={cn(
            "flex flex-col gap-2.5 rounded-[14px] border p-4",
            mode === "resolving" ? "border-[rgba(61,214,140,0.25)] bg-[rgba(61,214,140,0.06)]" : "border-border-hairline bg-white/[0.03]"
          )}
        >
          <label htmlFor={`note-${demand.id}`} className="text-[13px] font-semibold text-ink">
            {mode === "resolving" ? "O que foi feito?" : "Como está andando?"}
          </label>
          <textarea
            id={`note-${demand.id}`}
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={mode === "resolving" ? "Ex.: mandei lembrete por WhatsApp para os 9 pacientes; 7 confirmaram." : "Ex.: liguei para 9 dos 14 pacientes; 6 remarcaram."}
            className="w-full resize-none rounded-xl border border-white/10 bg-[rgba(11,12,18,0.5)] px-3.5 py-3 text-[13px] text-ink placeholder:text-ink-faint"
          />
          {mode === "resolving" && (
            <span className="text-xs text-ink-muted">A gestão recebe o aviso na hora. O Insighta confere nos dados nos próximos dias se o problema sumiu.</span>
          )}
          <div className="flex gap-2.5">
            <button
              type="button"
              disabled={note.trim().length < 3 || action.isPending}
              onClick={() => run(mode === "resolving" ? "resolve" : "update")}
              className={cn(
                "h-[38px] rounded-[11px] px-4 text-[13px] font-semibold disabled:opacity-50",
                mode === "resolving" ? "bg-[#3DD68C] text-[#0B0C12]" : "bg-brand text-white"
              )}
            >
              {mode === "resolving" ? "Confirmar resolução" : "Enviar atualização"}
            </button>
            <button type="button" onClick={() => setMode("idle")} className="h-[38px] rounded-[11px] border border-white/[0.12] px-3.5 text-[13px] text-ink">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 rounded-[14px] border border-[rgba(139,124,246,0.3)] bg-[rgba(139,124,246,0.07)] p-4">
          <span className="text-[13px] font-semibold text-ink">Por que você está devolvendo?</span>
          <div className="flex flex-wrap gap-2">
            {RETURN_REASONS.map((r) => (
              <button
                key={r.id}
                type="button"
                aria-pressed={reason === r.id}
                onClick={() => setReason(r.id)}
                className={cn(
                  "h-8 rounded-full border px-3 text-xs",
                  reason === r.id ? "border-accent/50 bg-brand/[0.22] text-ink" : "border-white/[0.12] text-ink-muted"
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
          <label htmlFor={`motivo-${demand.id}`} className="text-xs text-ink-muted">
            Explique para a gestão
          </label>
          <textarea
            id={`motivo-${demand.id}`}
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ex.: preciso até segunda para falar com todos os pacientes."
            className="w-full resize-none rounded-xl border border-white/10 bg-[rgba(11,12,18,0.5)] px-3.5 py-3 text-[13px] text-ink placeholder:text-ink-faint"
          />
          <div className="flex gap-2.5">
            <button
              type="button"
              disabled={note.trim().length < 3 || action.isPending}
              onClick={() => run("return")}
              className="h-[38px] rounded-[11px] bg-brand px-4 text-[13px] font-medium text-white disabled:opacity-50"
            >
              Devolver para {manager}
            </button>
            <button type="button" onClick={() => setMode("idle")} className="h-[38px] rounded-[11px] border border-white/[0.12] px-3.5 text-[13px] text-ink">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

function ResolvedDemandCard({ demand }: { demand: Demand }) {
  const status =
    demand.confirmation === "confirmado"
      ? "Confirmada pelos dados: o problema sumiu"
      : demand.confirmation === "voltou"
        ? "O problema voltou a aparecer nos dados"
        : "Aguardando confirmação dos dados";
  return (
    <article className="flex flex-col gap-2.5 rounded-[20px] border border-[rgba(61,214,140,0.2)] bg-white/[0.02] px-6 py-5">
      <div className="flex flex-wrap items-center gap-2.5">
        <Pill tone={demand.confirmation === "voltou" ? "amber" : "green"}>Resolvida</Pill>
        <span className="text-xs text-ink-muted">{status}</span>
        {demand.resolved_at && <span className="ml-auto text-xs text-ink-faint">Você resolveu em {shortDate(demand.resolved_at)}</span>}
      </div>
      <h3 className="text-base font-semibold text-ink">{demand.title}</h3>
      {demand.resolution_note && <p className="text-[13px] text-ink-muted">“{demand.resolution_note}”</p>}
    </article>
  );
}

/**
 * Canvas "Coordenador" (Redesign 2026): a Home de quem coordena um setor.
 * Só as demandas dele e o "Radar do setor" — nunca a visão geral do
 * gestor (decisão de produto: cada coordenador vê os problemas do próprio
 * setor).
 */
export function CoordinatorHomePage() {
  const { data: me } = useCurrentUserProfile();
  const summary = useCoordinatorSummary();
  const demandsQuery = useDemands();
  const sectors = summary.data?.sectors ?? [];
  const coordinatesAgenda = sectors.some((s) => s.sector === "agendamento");
  const { data: agenda } = useQuery({
    queryKey: ["analytics", "today-agenda"],
    queryFn: () => apiClient.get<TodayAgenda>("/api/v1/analytics/today-agenda"),
    enabled: coordinatesAgenda,
    retry: false,
  });

  if (summary.isLoading || demandsQuery.isLoading) return <LoadingState rows={6} />;
  const s = summary.data;
  const demands = demandsQuery.data ?? [];
  const open = demands
    .filter((d) => d.status === "pendente" || d.status === "em_andamento")
    .sort((a, b) => Number(!!b.nudged_at) - Number(!!a.nudged_at) || Number(b.is_overdue) - Number(a.is_overdue));
  const recent = demands.filter((d) => d.status === "resolvido" && d.resolved_at && Date.now() - new Date(d.resolved_at).getTime() < 30 * 86400000);
  const sectorLabel = sectors.map((x) => x.label).join(" e ");
  const dateLine = capitalize(new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
  const dueToday = s?.due_today_count ?? 0;
  const score = s?.score;

  const subtitle =
    s?.profile === "sem_setor"
      ? "Você ainda não coordena nenhum setor. Quando a gestão te cadastrar, suas demandas aparecem aqui."
      : open.length === 0
        ? "Nenhuma demanda aberta agora. Tudo aqui é do seu setor."
        : `Você tem ${plural(open.length, "demanda aberta", "demandas abertas")}${dueToday ? ` — ${dueToday} ${dueToday === 1 ? "vence" : "vencem"} hoje` : ""}. Tudo aqui é do seu setor.`;

  return (
    <div className="flex flex-col gap-7 pb-12">
      <header className="flex flex-col gap-6 border-b border-border-hairline pb-[26px] pt-1 lg:flex-row lg:items-end">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-ink-faint">
            {sectorLabel && <span className="font-semibold uppercase tracking-[0.08em] text-accent">Coordenação de {sectorLabel}</span>}
            {sectorLabel && " · "}
            {dateLine}
          </span>
          <h1 className="text-[36px] font-semibold tracking-[-0.02em] text-ink">
            {greeting()}
            {me?.full_name ? `, ${firstNameFrom(me.full_name)}` : ""}
          </h1>
          <p className="text-[15px] text-ink-muted">{subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2 lg:ml-auto">
          {dueToday > 0 && (
            <span className="flex h-[30px] items-center gap-2 rounded-lg border border-[rgba(242,107,107,0.25)] bg-[rgba(242,107,107,0.1)] px-3 text-xs text-[#FF8A8A]">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#F26B6B]" />
              {dueToday} {dueToday === 1 ? "vence" : "vencem"} hoje
            </span>
          )}
          {!!s?.in_progress_count && (
            <span className="flex h-[30px] items-center gap-2 rounded-lg border border-[rgba(240,180,76,0.22)] bg-[rgba(240,180,76,0.09)] px-3 text-xs text-[#F0B44C]">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#F0B44C]" />
              {s.in_progress_count} em andamento
            </span>
          )}
          {!!s?.awaiting_confirmation_count && (
            <span className="flex h-[30px] items-center gap-2 rounded-lg border border-[rgba(61,214,140,0.2)] bg-[rgba(61,214,140,0.08)] px-3 text-xs text-[#3DD68C]">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#3DD68C]" />
              {s.awaiting_confirmation_count} aguardando confirmação
            </span>
          )}
        </div>
      </header>

      <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section aria-labelledby="minhas" className="flex flex-col gap-4">
          <h2 id="minhas" className="text-lg font-semibold text-ink">
            Suas demandas
          </h2>
          {open.length === 0 && recent.length === 0 && (
            <p className="rounded-[20px] border border-border-hairline bg-white/[0.02] p-6 text-sm text-ink-muted">
              Nada com você agora. Quando a gestão atribuir algo ao seu setor, aparece aqui — com o prazo e o que ela espera.
            </p>
          )}
          {open.map((d) => (
            <OpenDemandCard key={d.id} demand={d} />
          ))}
          {recent.map((d) => (
            <ResolvedDemandCard key={d.id} demand={d} />
          ))}
        </section>

        <aside className="flex flex-col gap-6">
          <section aria-labelledby="placar-c" className="flex flex-col gap-4 rounded-[20px] border border-border-hairline bg-white/[0.03] p-6">
            <h2 id="placar-c" className="text-base font-semibold text-ink">
              Seu placar do mês
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-[28px] font-semibold text-ink">{score?.resolved_count ?? 0}</span>
                <span className="text-xs text-ink-muted">resolvidas</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[28px] font-semibold text-ink">{score?.on_time_pct == null ? "—" : `${Math.round(score.on_time_pct)}%`}</span>
                <span className="text-xs text-ink-muted">no prazo</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[28px] font-semibold text-ink">{score?.evaluated_count ? `${score.confirmed_count} de ${score.evaluated_count}` : "—"}</span>
                <span className="text-xs text-ink-muted">confirmadas pelos dados</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[28px] font-semibold text-[#3DD68C]">{brlWhole(score?.recovered_value ?? 0)}</span>
                <span className="text-xs text-ink-muted">recuperados</span>
              </div>
            </div>
            <p className="text-[13px] leading-relaxed text-ink-soft">A gestão vê este mesmo placar.</p>
          </section>

          <section aria-labelledby="radar" className="flex flex-col gap-3.5 rounded-[20px] border border-border-hairline bg-white/[0.03] p-6">
            <div className="flex flex-col gap-1">
              <h2 id="radar" className="text-base font-semibold text-ink">
                Radar do setor
              </h2>
              <p className="text-xs text-ink-faint">O Insighta está de olho. Quem decide o que vira demanda é a gestão.</p>
            </div>
            {(s?.radar ?? []).length === 0 ? (
              <p className="text-[13px] text-ink-muted">Nada fora do normal no seu setor agora.</p>
            ) : (
              s!.radar.map((r) => (
                <div key={r.title} className="flex gap-3 rounded-xl bg-[rgba(11,12,18,0.45)] p-3">
                  <span
                    aria-hidden
                    className={cn(
                      "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                      r.severity === "critical" ? "bg-[#F26B6B]" : r.severity === "positive" ? "bg-[#3DD68C]" : "bg-[#F0B44C]"
                    )}
                  />
                  <div className="flex flex-col gap-[3px]">
                    <span className="text-[13px] font-medium text-ink">{r.title}</span>
                    <span className="text-xs text-ink-muted">{r.message}</span>
                  </div>
                </div>
              ))
            )}
          </section>

          {coordinatesAgenda && agenda && (
            <section aria-labelledby="agenda-c" className="flex flex-col gap-3 rounded-[20px] border border-border-hairline bg-white/[0.03] p-6">
              <h2 id="agenda-c" className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-faint">
                A agenda de hoje
              </h2>
              <p className="font-serif text-[20px] leading-[1.35] text-ink">{agenda.headline}</p>
              <div className="grid grid-cols-[64px_minmax(0,1fr)] gap-x-3 gap-y-2.5 text-[13px] leading-relaxed">
                {agenda.periods.map((p) => (
                  <div key={p.label} className="contents">
                    <span className="text-ink-faint">{p.label}</span>
                    <span className="text-ink-soft">
                      {p.text}{" "}
                      {p.action_label && p.action_href && (
                        <Link to={p.action_href} className="text-[#F0B44C] hover:underline">
                          {p.action_label}
                        </Link>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </aside>
      </div>
      {summary.error && <p className="text-xs text-denied">{getApiErrorMessage(summary.error)}</p>}
    </div>
  );
}
