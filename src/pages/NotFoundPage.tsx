import { Link, useLocation } from "react-router-dom";
import { Compass } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";

const SHORTCUTS = [
  { to: "/", label: "Início", hint: "o resumo do dia" },
  { to: "/importar", label: "Importar dados", hint: "enviar planilhas e ver o histórico" },
  { to: "/convenios", label: "Convênios", hint: "glosas, prazos e contratos" },
  { to: "/decisao", label: "Sala de Comando", hint: "números e alertas da clínica" },
];

/** UX3-23: endereço inexistente voltava para o Início sem dizer nada. */
export function NotFoundPage() {
  const { pathname } = useLocation();
  return (
    <div className="space-y-6">
      <PageHeader
        icon={Compass}
        title="Não encontramos esta tela"
        subtitle={`O endereço ${pathname} não existe ou mudou de lugar. Use um dos atalhos abaixo ou o campo “Pergunte ao Insighta” no topo para ir direto a um módulo.`}
      />
      <Panel>
        <ul className="divide-y divide-border-hairline">
          {SHORTCUTS.map((s) => (
            <li key={s.to}>
              <Link to={s.to} className="flex items-baseline gap-3 px-4 py-3 text-sm hover:bg-canvas-raised/40">
                <span className="font-medium text-accent">{s.label}</span>
                <span className="text-ink-muted">{s.hint}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
