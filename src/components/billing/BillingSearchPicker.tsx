import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { apiClient } from "@/lib/api-client";
import type { BillingSearchItem } from "@/lib/types";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

/**
 * Autocomplete de faturamento por nome/CPF do paciente — GET
 * /billing/search (ver DECISÃO em BillingRepository.search, backend).
 *
 * DECISÃO — substitui o campo de UUID cru, não é um select genérico
 * -------------------------------------------------------------------
 * Achado do Raio-X da Sala de Comando: tanto "Recurso de Glosa" quanto
 * "registrar pagamento recebido" já funcionavam de ponta a ponta no
 * backend, mas exigiam colar o billing_id (UUID interno) — a barreira
 * real de uso era só essa, não faltava lógica nenhuma. Este componente é
 * o substituto direto: busca por nome, mostra paciente/procedimento/
 * convênio/valor para o usuário reconhecer visualmente qual fatura é a
 * certa, e devolve só o billing_id escolhido pro formulário que o usa.
 */
export function BillingSearchPicker({
  selected,
  onSelect,
  error,
}: {
  selected: BillingSearchItem | null;
  onSelect: (item: BillingSearchItem | null) => void;
  error?: string;
}) {
  const [term, setTerm] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedTerm(term), 300);
    return () => clearTimeout(handle);
  }, [term]);

  const query = useQuery({
    queryKey: ["billing-search", debouncedTerm],
    queryFn: () => apiClient.get<BillingSearchItem[]>(`/api/v1/billing/search?q=${encodeURIComponent(debouncedTerm)}`),
    enabled: debouncedTerm.trim().length >= 2 && selected === null,
  });

  if (selected) {
    return (
      <div className="mb-4">
        <span className="mb-1.5 block text-xs font-medium text-ink-muted">Faturamento</span>
        <div className="flex items-center justify-between gap-3 rounded-md border border-border-default bg-canvas-raised px-3 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-sm text-ink">{selected.patient_name}</p>
            <p className="mt-0.5 text-2xs text-ink-faint">
              {selected.procedure_code ?? "sem procedimento"} · {selected.insurance_plan_name} ·{" "}
              {formatCurrency(selected.charged_value)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <RiskBadge level={selected.denial_risk_level} />
            <button
              type="button"
              onClick={() => onSelect(null)}
              aria-label="Trocar faturamento selecionado"
              className="rounded-sm p-1 text-ink-faint transition-colors hover:bg-canvas-surface/60 hover:text-ink"
            >
              <X aria-hidden size={14} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4">
      <label htmlFor="billing-search" className="mb-1.5 block text-xs font-medium text-ink-muted">
        Buscar faturamento (nome ou CPF do paciente)
        <span className="text-denied"> *</span>
      </label>
      <div className="relative">
        <Search aria-hidden size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
        <input
          id="billing-search"
          type="text"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Ex.: Maria da Silva"
          aria-invalid={!!error}
          className={`w-full rounded-md border bg-canvas-raised py-2 pl-8 pr-3 text-sm text-ink placeholder:text-ink-faint transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15 ${
            error ? "border-denied/50" : "border-border-default"
          }`}
        />
      </div>
      {error && (
        <p role="alert" className="mt-1 text-2xs text-denied">
          {error}
        </p>
      )}
      {debouncedTerm.trim().length >= 2 && (
        <div className="mt-1.5 max-h-64 overflow-y-auto rounded-md border border-border-hairline bg-canvas-surface">
          {query.isLoading && <p className="px-3 py-2.5 text-xs text-ink-faint">Buscando...</p>}
          {query.data && query.data.length === 0 && (
            <p className="px-3 py-2.5 text-xs text-ink-faint">Nenhum faturamento encontrado com esse nome/CPF.</p>
          )}
          {query.data && query.data.length > 0 && (
            <ul>
              {query.data.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(item);
                      setTerm("");
                    }}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-canvas-raised/60"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-ink">{item.patient_name}</p>
                      <p className="mt-0.5 text-2xs text-ink-faint">
                        {item.procedure_code ?? "sem procedimento"} · {item.insurance_plan_name} ·{" "}
                        {formatCurrency(item.charged_value)}
                      </p>
                    </div>
                    <RiskBadge level={item.denial_risk_level} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
