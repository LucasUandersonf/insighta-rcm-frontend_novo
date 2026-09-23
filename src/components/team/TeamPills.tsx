import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { Demand } from "@/lib/team";

/** Pílulas do canvas de Equipe (cores exatas: vermelho/âmbar/verde/violeta/azul). */
export type PillTone = "red" | "amber" | "green" | "violet" | "blue";

const TONES: Record<PillTone, string> = {
  red: "bg-[rgba(242,107,107,0.14)] text-[#FF8A8A]",
  amber: "bg-[rgba(240,180,76,0.13)] text-[#F0B44C]",
  green: "bg-[rgba(61,214,140,0.13)] text-[#3DD68C]",
  violet: "bg-[rgba(139,124,246,0.16)] text-[#D6CFFF]",
  blue: "bg-[rgba(56,152,236,0.14)] text-[#7CC4F5]",
};

export function Pill({ tone, children }: { tone: PillTone; children: ReactNode }) {
  return <span className={cn("whitespace-nowrap rounded-md px-2 py-[3px] text-[11px] font-semibold", TONES[tone])}>{children}</span>;
}

const SEVERITY: Record<string, { label: string; tone: PillTone }> = {
  critical: { label: "Crítico", tone: "red" },
  warning: { label: "Atenção", tone: "amber" },
  positive: { label: "Oportunidade", tone: "green" },
  comparativo: { label: "Comparativo", tone: "violet" },
};

export function SeverityPill({ severity }: { severity: string }) {
  const cfg = SEVERITY[severity] ?? { label: "Atenção", tone: "amber" as const };
  return <Pill tone={cfg.tone}>{cfg.label}</Pill>;
}

/** Status que o gestor vê: "Atrasada" tem prioridade sobre Nova/Em andamento. */
export function demandTone(d: Demand): { label: string; tone: PillTone } {
  if (d.is_overdue) return { label: "Atrasada", tone: "red" };
  switch (d.status) {
    case "pendente":
      return { label: "Nova", tone: "blue" };
    case "em_andamento":
      return { label: "Em andamento", tone: "amber" };
    case "resolvido":
      return { label: "Resolvida", tone: "green" };
    case "devolvido":
      return { label: "Devolvida", tone: "violet" };
    default:
      return { label: d.status_label, tone: "violet" };
  }
}

export function DemandStatusPill({ demand }: { demand: Demand }) {
  const t = demandTone(demand);
  return <Pill tone={t.tone}>{t.label}</Pill>;
}
