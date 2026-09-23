import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Info } from "lucide-react";
import { Link } from "react-router-dom";
import { Modal } from "@/components/ui/Modal";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { cn } from "@/lib/cn";
import { useToast } from "@/context/ToastContext";
import type { PriorityQueueItem } from "@/lib/types";
import {
  ASSIGNABLE_SECTORS,
  CATEGORY_LABELS,
  CATEGORY_TO_SECTOR,
  brlWhole,
  deadlineOptions,
  firstName,
  useTeamSectors,
  type Demand,
  type DemandCreate,
  type TeamSector,
} from "@/lib/team";
import { SeverityPill } from "@/components/team/TeamPills";

/**
 * Canvas "Atribuir" (Redesign 2026): o gestor repassa a demanda ao
 * COORDENADOR DO SETOR — não a uma pessoa qualquer. O setor sugerido vem
 * da área do insight (agenda -> Agendamento, faturamento -> Faturamento…);
 * setor sem coordenador aparece desabilitado com o caminho para cadastrar.
 */
export function AssignDemandModal({
  item,
  onClose,
  onAssigned,
}: {
  item: PriorityQueueItem | null;
  onClose: () => void;
  onAssigned: (item: PriorityQueueItem) => void;
}) {
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();
  const { data: sectors } = useTeamSectors(Boolean(item));
  const deadlines = useMemo(() => deadlineOptions(), []);
  const suggested = item ? CATEGORY_TO_SECTOR[item.category] : undefined;

  const options = useMemo(() => {
    const byId = new Map((sectors ?? []).map((s) => [s.sector, s]));
    const ordered = [...ASSIGNABLE_SECTORS].sort((a, b) => Number(b === suggested) - Number(a === suggested));
    return ordered.map((id) => byId.get(id)).filter((s): s is NonNullable<typeof s> => Boolean(s));
  }, [sectors, suggested]);

  const [sector, setSector] = useState<TeamSector | null>(null);
  const [deadline, setDeadline] = useState(2);
  const [customDate, setCustomDate] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!item) return;
    setSector((current) => current ?? options.find((s) => s.coordinator)?.sector ?? null);
  }, [item, options]);

  const chosen = options.find((s) => s.sector === sector);
  const who = chosen?.coordinator ? firstName(chosen.coordinator.full_name) : null;
  const dueDate = deadlines[deadline]?.value ?? (customDate || null);

  const mutation = useMutation({
    mutationFn: (payload: DemandCreate) => apiClient.post<Demand>("/api/v1/team/demands", payload),
    onSuccess: (demand) => {
      showSuccess(`Atribuído a ${demand.coordinator?.full_name ?? "coordenação"}. Você acompanha em Equipe.`);
      queryClient.invalidateQueries({ queryKey: ["team"] });
      if (item) onAssigned(item);
      handleClose();
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  function handleClose() {
    setSector(null);
    setDeadline(2);
    setCustomDate("");
    setNote("");
    onClose();
  }

  if (!item) return null;

  function handleSubmit() {
    if (!item || !sector) return;
    mutation.mutate({
      source: item.source === "raiox" ? "raiox" : "insight",
      category: item.category,
      severity: item.severity,
      title: item.title,
      message: item.message,
      financial_impact: item.financial_impact,
      rule_id: item.rule_id ?? null,
      fact_key: item.fact_key ?? null,
      sector,
      due_date: dueDate,
      manager_note: note.trim() || null,
    });
  }

  return (
    <Modal title="Atribuir ao coordenador" isOpen={Boolean(item)} onClose={handleClose}>
      <div className="flex flex-col gap-5">
        <p className="-mt-2 text-[13px] text-ink-muted">Você repassa a demanda e acompanha. Quem resolve é o coordenador do setor.</p>

        <div className="flex items-start gap-3.5 rounded-[14px] border border-border-hairline bg-white/[0.03] p-4">
          <SeverityPill severity={item.severity} />
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-sm font-semibold text-ink">{item.title}</span>
            <span className="text-xs text-ink-faint">
              {CATEGORY_LABELS[item.category] ?? item.category}
              {item.financial_impact ? ` · impacto estimado ${brlWhole(item.financial_impact)}` : ""}
            </span>
          </div>
        </div>

        <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
          <legend className="mb-2.5 text-xs font-semibold text-ink">Setor responsável</legend>
          {options.map((s) => {
            const enabled = Boolean(s.coordinator);
            const on = sector === s.sector;
            return (
              <button
                key={s.sector}
                type="button"
                aria-pressed={on}
                disabled={!enabled}
                onClick={() => setSector(s.sector)}
                className={cn(
                  "flex w-full items-center gap-3.5 rounded-xl border px-3.5 py-3 text-left transition-colors",
                  on ? "border-accent/50 bg-brand/[0.14]" : "border-border-hairline bg-white/[0.02] hover:bg-white/[0.04]",
                  !enabled && "cursor-not-allowed opacity-55"
                )}
              >
                <span
                  aria-hidden
                  className={cn("h-4 w-4 shrink-0 rounded-full", on ? "border-[5px] border-accent-muted" : "border-[1.5px] border-white/30")}
                />
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-ink">{s.label}</span>
                  <span className={cn("text-xs", enabled ? "text-ink-muted" : "text-pending")}>
                    {s.coordinator ? `Coordenação: ${s.coordinator.full_name}` : "Sem coordenador — Cadastre em Usuários e permissões"}
                  </span>
                </span>
                {s.sector === suggested && (
                  <span className="ml-auto rounded-md bg-accent/[0.16] px-2 py-[3px] text-2xs font-semibold text-accent">Sugerido</span>
                )}
              </button>
            );
          })}
          {options.length > 0 && options.every((s) => !s.coordinator) && (
            <p className="text-xs text-pending">
              Nenhum setor tem coordenador ainda.{" "}
              <Link to="/admin/users" className="underline" onClick={handleClose}>
                Cadastrar em Usuários e permissões
              </Link>
            </p>
          )}
        </fieldset>

        <div className="flex flex-col gap-2.5">
          <span className="text-xs font-semibold text-ink">Prazo</span>
          <div className="flex flex-wrap gap-2">
            {deadlines.map((d, i) => (
              <button
                key={d.label}
                type="button"
                aria-pressed={deadline === i}
                onClick={() => setDeadline(i)}
                className={cn(
                  "h-[34px] rounded-full border px-3.5 text-[13px] transition-colors",
                  deadline === i ? "border-accent/45 bg-brand/20 text-ink" : "border-white/[0.12] text-ink-muted hover:text-ink"
                )}
              >
                {d.label}
              </button>
            ))}
          </div>
          {deadlines[deadline]?.value === null && (
            <input
              type="date"
              aria-label="Data do prazo"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="h-10 w-48 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-[13px] text-ink"
            />
          )}
        </div>

        <label className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-ink">
            Observação para o coordenador <span className="font-normal text-ink-faint">(opcional)</span>
          </span>
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ex.: priorize os pacientes de alto valor e use a lista de espera."
            className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-3 text-[13px] text-ink placeholder:text-ink-faint"
          />
        </label>

        {who && (
          <div className="flex gap-2.5 rounded-xl border border-accent/[0.22] bg-brand/10 px-3.5 py-3">
            <Info aria-hidden size={15} className="mt-0.5 shrink-0 text-accent" />
            <span className="text-xs leading-relaxed text-ink-soft">
              {who} recebe a demanda na Home. Você acompanha o status em Equipe e recebe um aviso na sua Home quando for resolvido — e de novo
              quando os dados confirmarem.
            </span>
          </div>
        )}

        <div className="flex justify-end gap-2.5">
          <button type="button" onClick={handleClose} className="h-10 rounded-[11px] border border-white/[0.12] px-4 text-[13px] text-ink">
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!sector || !who || mutation.isPending || (deadlines[deadline]?.value === null && !customDate)}
            className="h-10 rounded-[11px] bg-brand px-[18px] text-[13px] font-medium text-white disabled:opacity-50"
          >
            {mutation.isPending ? "Atribuindo..." : who ? `Atribuir a ${who}` : "Atribuir"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
