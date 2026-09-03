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
 * DECISÃO — aba sublinhada (`.underline-tabs`/`.utab`), não mais pílula
 * deslizante
 * -------------------------------------------------------------------
 * A primeira versão deste componente usava um indicador em pílula com
 * o gradiente de marca deslizando por trás da aba ativa. O canvas de
 * design (fonte da verdade visual, ver Painel.dc.html/CentralDeUpload.dc.html)
 * usa um tratamento mais discreto e "de aplicativo denso": abas sem
 * moldura, fundo raised só na ativa, e uma barrinha fina na cor de
 * acento embaixo dela — mais parecido com abas de navegador do que com
 * um seletor de segmento. O toque de Motion se mantém (a barrinha
 * desliza via `layoutId` em vez de só trocar de lugar), só a "pele"
 * mudou.
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
    <div role="tablist" aria-orientation="horizontal" className={cn("flex gap-1 border-b border-border-hairline", className)}>
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
              "relative flex items-center gap-1.5 rounded-t-[10px] px-3.5 py-2.5 text-sm font-medium transition-colors",
              isActive ? "bg-canvas-raised text-ink" : "text-ink-faint hover:text-ink-muted"
            )}
          >
            {item.icon && <item.icon aria-hidden size={13} />}
            <span>{item.label}</span>
            {isActive && (
              <motion.span
                layoutId={`tabs-active-underline-${groupId}`}
                className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-accent"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
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
