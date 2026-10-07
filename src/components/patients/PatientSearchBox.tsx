import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import type { PatientSearchItem } from "@/lib/types";

/** Busca de paciente por nome ou CPF (Ficha do Paciente e Consultas —
 * UX-14: Consultas usava um select com todos os pacientes da base). */
export function PatientSearchBox({
  onSelect,
  className = "mx-auto max-w-lg",
}: {
  onSelect: (item: PatientSearchItem) => void;
  className?: string;
}) {
  const [term, setTerm] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedTerm(term), 300);
    return () => clearTimeout(handle);
  }, [term]);

  const query = useQuery({
    queryKey: ["patients", "search", debouncedTerm],
    queryFn: () => apiClient.get<PatientSearchItem[]>(`/api/v1/patients/search?q=${encodeURIComponent(debouncedTerm)}`),
    enabled: debouncedTerm.trim().length >= 2,
  });

  return (
    <div className={className}>
      <label htmlFor="patient-search" className="mb-1.5 block text-xs font-medium text-ink-muted">
        Buscar paciente por nome ou CPF
      </label>
      <div className="relative">
        <Search aria-hidden size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
        <input
          id="patient-search"
          type="text"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Ex.: Maria da Silva"
          className="w-full rounded-md border border-border-default bg-canvas-raised py-2.5 pl-8 pr-3 text-sm text-ink placeholder:text-ink-faint transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
        />
      </div>
      {debouncedTerm.trim().length >= 2 && (
        <div className="mt-1.5 max-h-72 overflow-y-auto rounded-md border border-border-hairline bg-canvas-surface">
          {query.isLoading && <p className="px-3 py-2.5 text-xs text-ink-faint">Buscando...</p>}
          {query.data && query.data.length === 0 && (
            <p className="px-3 py-2.5 text-xs text-ink-faint">Nenhum paciente encontrado com esse nome/CPF.</p>
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
                    <span className="truncate text-sm text-ink">{item.full_name}</span>
                    {item.cpf && <span className="shrink-0 font-mono text-2xs text-ink-faint">{item.cpf}</span>}
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
