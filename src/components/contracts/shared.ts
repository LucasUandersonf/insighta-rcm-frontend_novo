import { type BadgeTone } from "@/components/ui/Badge";
import type { Contract } from "@/lib/types";
import { formatDateBR } from "@/lib/dates";

export function formatMoney(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatDate(iso: string): string {
  return formatDateBR(iso, { day: "2-digit", month: "2-digit", year: "numeric", });
}

export const STATUS_LABELS: Record<Contract["status"], string> = {
  rascunho: "Rascunho (tabela ainda não lida)",
  em_revisao: "Em conferência",
  homologado: "Tabela aprovada",
};

export const STATUS_TONE: Record<Contract["status"], BadgeTone> = {
  rascunho: "neutral",
  em_revisao: "pending",
  homologado: "revenue",
};

// ---------------------------------------------------------------------
// Convênios (Operadoras)
// ---------------------------------------------------------------------
