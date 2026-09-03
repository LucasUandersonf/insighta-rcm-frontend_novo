import type { ReactNode } from "react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

interface TabItem {
  id: string;
  label: string;
  icon?: LucideIcon;
}

/**
 * Alternador de sub-painéis (ex: Painel → Faturamento/Agenda) — extraído
 * como componente de design system em vez de um `useState` + botões
 * soltos dentro de uma única página, porque a mesma necessidade (dividir
 * uma tela grande em vistas por domínio, sem sair da rota) já apareceu
 * uma vez e provavelmente vai aparecer de novo (ex: Painel → Pacientes,
 * no futuro).
 *
 * Papéis ARIA de abas de verdade (`tablist`/`tab`) — cada aba já é
 * `aria-selected`, e quem usa este componente é responsável por só
 * renderizar o conteúdo (`tabpanel`) da aba ativa, não por esconder com
 * CSS (evita montar 2x as queries/gráficos da aba escondida).
 *
 * O indicador da aba ativa é o mesmo `bg-aura-line` do CTA de marca —
 * usa `layoutId` do Framer Motion para deslizar entre as abas em vez de
 * só trocar de cor, o toque de Motion que faz a troca parecer uma
 * transição física, não um replace instantâneo de estado.
 *
 * `groupId` é explícito (não gerado internamente via useId) para que o
 * `<TabPanel>` correspondente, renderizado por quem chama, consiga
 * casar `aria-labelledby`/`id` com este componente sem os dois
 * precisarem compartilhar uma instância de hook.
 */
export function Tabs({
  items,
  active,
  onChange,
  groupId,
  className,
}: {
  items: TabItem[];
  active: string;
  onChange: (id: string) => void;
  groupId: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-orientation="horizontal"
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border border-border-hairline bg-glass p-1 shadow-card backdrop-blur-xl",
        className
      )}
    >
      {items.map((item) => {
        const isActive = item.id === active;
        return (
          <button
            key={item.id}
            id={`tab-${groupId}-${item.id}`}
            role="tab"
            type="button"
            aria-selected={isActive}
            aria-controls={`tabpanel-${groupId}-${item.id}`}
            onClick={() => onChange(item.id)}
            className={cn(
              "relative flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors",
              isActive ? "text-white" : "text-ink-muted hover:text-ink"
            )}
          >
            {isActive && (
              <motion.span
                layoutId={`tabs-active-pill-${groupId}`}
                className="absolute inset-0 rounded-md bg-aura-line"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            {item.icon && <item.icon aria-hidden size={14} className="relative z-10" />}
            <span className="relative z-10">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Wrapper de conteúdo de uma aba — só cuida do papel ARIA
 * (`tabpanel`/`aria-labelledby`); quem chama decide se/quando montar
 * (condicional no JSX de quem usa, não `hidden` aqui). */
export function TabPanel({ id, groupId, children }: { id: string; groupId: string; children: ReactNode }) {
  return (
    <div role="tabpanel" id={`tabpanel-${groupId}-${id}`} aria-labelledby={`tab-${groupId}-${id}`}>
      {children}
    </div>
  );
}
