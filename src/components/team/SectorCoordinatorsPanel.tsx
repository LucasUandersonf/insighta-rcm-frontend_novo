import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Panel } from "@/components/ui/Panel";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { useToast } from "@/context/ToastContext";
import { ASSIGNABLE_SECTORS, useTeamSectors, type SectorInfo, type TeamSector } from "@/lib/team";
import type { PlatformUser } from "@/lib/types";

/**
 * Equipe (Redesign 2026): "apenas um coordenador por módulo". O gestor
 * escolhe aqui quem coordena cada setor — é para essa pessoa que vão as
 * demandas atribuídas em "Atribuir". Gestores (owner/admin) não
 * coordenam: eles atribuem.
 */
export function SectorCoordinatorsPanel({ users }: { users: PlatformUser[] }) {
  const { data: sectors } = useTeamSectors();
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const candidates = users.filter((u) => u.is_active && u.role !== "owner" && u.role !== "admin");

  const mutation = useMutation({
    mutationFn: ({ sector, coordinator_id }: { sector: TeamSector; coordinator_id: string | null }) =>
      apiClient.put<SectorInfo>(`/api/v1/team/sectors/${sector}`, { coordinator_id }),
    onSuccess: (s) => {
      showSuccess(s.coordinator ? `${s.coordinator.full_name} agora coordena ${s.label}.` : `${s.label} ficou sem coordenador.`);
      queryClient.invalidateQueries({ queryKey: ["team"] });
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  const rows = (sectors ?? []).filter((s) => ASSIGNABLE_SECTORS.includes(s.sector));

  return (
    <Panel title="Coordenadores por setor" subtitle="Um coordenador por setor. É ele quem recebe as demandas que você atribui e aparece no placar da Equipe.">
      <div className="grid gap-3 p-4 sm:grid-cols-2">
        {rows.map((s) => (
          <label key={s.sector} className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-ink">{s.label}</span>
            <select
              aria-label={`Coordenador de ${s.label}`}
              value={s.coordinator?.id ?? ""}
              disabled={mutation.isPending}
              onChange={(e) => mutation.mutate({ sector: s.sector, coordinator_id: e.target.value || null })}
              className="h-10 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-[13px] text-ink"
            >
              <option value="">Sem coordenador</option>
              {candidates.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </Panel>
  );
}
