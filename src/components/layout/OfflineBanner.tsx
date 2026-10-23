import { WifiOff } from "lucide-react";
import { useOnline } from "@/lib/useOnline";

/** UX-23: sem internet, avisa na hora (antes: "Salvando…" para sempre e
 * status verde "dados sincronizados"). */
export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div role="status" className="flex items-center gap-2.5 border-b border-pending/30 bg-pending/10 px-4 py-2 text-sm text-ink sm:px-8">
      <WifiOff aria-hidden size={15} className="shrink-0 text-pending" />
      <span>
        <strong>Sem conexão com a internet.</strong> O que você salvar agora não chega ao servidor — tente de novo quando a conexão voltar.
      </span>
    </div>
  );
}
