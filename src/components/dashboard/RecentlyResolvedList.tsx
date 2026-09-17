import { CheckCircle2 } from "lucide-react";

/**
 * Selo de memória contínua dia-a-dia (Roadmap "Rumo à Nota 9", Fase 3) —
 * Avaliação Home/Sala de Comando, Achado 3: antes, "isto foi corrigido"
 * só existia se a IA decidisse mencionar dentro do texto narrado, sem
 * garantia nenhuma (a IA pode parafrasear, omitir por limite de frases,
 * ou simplesmente estar indisponível). Este selo é determinístico —
 * alimentado direto por `ExecutiveNarrative.recently_resolved`, nunca
 * pelo texto gerado — e aparece independente de `narrative` existir.
 */
export function RecentlyResolvedList({ titles }: { titles: string[] }) {
  if (titles.length === 0) return null;

  return (
    <ul className="space-y-1">
      {titles.map((title) => (
        <li key={title} className="flex items-center gap-1.5 text-xs text-revenue">
          <CheckCircle2 aria-hidden size={13} strokeWidth={2.25} className="shrink-0" />
          <span>Corrigido desde a última checagem: {title}</span>
        </li>
      ))}
    </ul>
  );
}
