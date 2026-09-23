import { Link } from "react-router-dom";
import { cn } from "@/lib/cn";
import { useAcknowledgeUpdates, type TeamUpdate } from "@/lib/team";

const KIND: Record<TeamUpdate["kind"], { label: string; text: string; bg: string; dot: string; link: string }> = {
  confirmado: { label: "Resolvido", text: "text-[#3DD68C]", bg: "bg-[rgba(61,214,140,0.08)] border-[rgba(61,214,140,0.2)]", dot: "bg-[#3DD68C]", link: "resolvidas" },
  resolvido: { label: "Resolvido", text: "text-[#3DD68C]", bg: "bg-[rgba(61,214,140,0.08)] border-[rgba(61,214,140,0.2)]", dot: "bg-[#3DD68C]", link: "resolvidas" },
  voltou: { label: "Voltou", text: "text-[#F0B44C]", bg: "bg-[rgba(240,180,76,0.08)] border-[rgba(240,180,76,0.22)]", dot: "bg-[#F0B44C]", link: "resolvidas" },
  devolvido: { label: "Devolvida", text: "text-[#D6CFFF]", bg: "bg-[rgba(139,124,246,0.08)] border-[rgba(139,124,246,0.25)]", dot: "bg-[#8B7CF6]", link: "devolvidas" },
};

/**
 * Canvas "Equipe": faixa "RESOLVIDO — Carla Mendes resolveu … — confirmado
 * pelos dados". Mesmo aviso na Home do gestor. "Ok, visto" confirma a
 * leitura (POST /team/updates/ack) e a faixa some até o próximo aviso.
 */
export function TeamUpdatesStrip({ updates, canAcknowledge, max = 1 }: { updates: TeamUpdate[]; canAcknowledge: boolean; max?: number }) {
  const ack = useAcknowledgeUpdates();
  if (updates.length === 0) return null;
  const shown = updates.slice(0, max);
  const rest = updates.length - shown.length;
  return (
    <div role="status" className="-mx-4 flex flex-col sm:-mx-8">
      {shown.map((u, i) => {
        const cfg = KIND[u.kind];
        const [head, ...tail] = u.text.split(" — ");
        return (
          <div key={u.demand_id} className={cn("flex flex-wrap items-center gap-x-3.5 gap-y-1 border-b px-4 py-3 sm:px-8", cfg.bg)}>
            <span className={cn("flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em]", cfg.text)}>
              <span aria-hidden className={cn("h-[7px] w-[7px] rounded-full", cfg.dot)} />
              {cfg.label}
            </span>
            <span className="min-w-0 flex-1 text-sm text-ink">
              {head}
              {tail.length > 0 && <span className={cfg.text}> — {tail.join(" — ")}</span>}
            </span>
            <span className="ml-auto flex items-center gap-4">
              <Link to={`/equipe?tab=${cfg.link}`} className={cn("text-[13px] font-medium hover:underline", cfg.text)}>
                {u.kind === "devolvido" ? "Decidir o que fazer →" : "Ver o que foi feito →"}
              </Link>
              {canAcknowledge && i === shown.length - 1 && (
                <button type="button" onClick={() => ack.mutate()} disabled={ack.isPending} className="text-[13px] text-ink-muted hover:text-ink">
                  {rest > 0 ? `Ok, visto (+${rest})` : "Ok, visto"}
                </button>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
